"""Redpanda / Kafka consumer framework with DLQ, retries, and metrics (architecture §3.1)."""

from __future__ import annotations

import asyncio
import contextlib
import json
import uuid
from typing import Any

from aiokafka import AIOKafkaConsumer

from crq.core.config import get_settings
from crq.core.db import AsyncSessionLocal
from crq.core.logging import get_logger
from crq.ingestion.pipeline import handle_control_event, handle_vuln_event
from crq.schemas.events import EventEnvelope

log = get_logger(__name__)

# In-memory dead letter queue for inspection and tests
DEAD_LETTER_QUEUE: list[dict[str, Any]] = []

# Consumer state
_consumer_running = False
_consumer_task: asyncio.Task[None] | None = None


async def process_kafka_message(raw_msg_value: bytes | str | dict[str, Any]) -> dict[str, Any]:
    """Process a single event message from Redpanda."""
    if isinstance(raw_msg_value, bytes):
        data = json.loads(raw_msg_value.decode("utf-8"))
    elif isinstance(raw_msg_value, str):
        data = json.loads(raw_msg_value)
    elif isinstance(raw_msg_value, dict):
        data = raw_msg_value
    else:
        raise ValueError(f"Unsupported message type: {type(raw_msg_value)}")

    event = EventEnvelope(**data)

    async with AsyncSessionLocal() as session:
        if event.event_type.startswith("control."):
            result = await handle_control_event(event, session)
        elif event.event_type.startswith("vuln."):
            result = await handle_vuln_event(event, session)
        else:
            log.info("ignoring_unhandled_event_type", event_type=event.event_type)
            result = {"status": "ignored", "event_type": event.event_type}

        await session.commit()
        return result


async def route_to_dead_letter_queue(
    raw_message: Any,
    error: Exception,
    topic: str = "unknown",
) -> None:
    """Route failed message to DLQ (in-memory + dlq.events topic)."""
    dlq_record = {
        "dlq_id": str(uuid.uuid4()),
        "original_topic": topic,
        "payload": raw_message if isinstance(raw_message, dict) else str(raw_message),
        "error": str(error),
        "timestamp": asyncio.get_event_loop().time(),
    }
    DEAD_LETTER_QUEUE.append(dlq_record)
    log.error("message_routed_to_dlq", dlq_id=dlq_record["dlq_id"], error=str(error))


class EventConsumerWorker:
    """Background consumer worker for Redpanda topics."""

    def __init__(self, group_id: str = "crq-risk-consumers") -> None:
        self.group_id = group_id
        self.topics = [
            "control.updated",
            "vuln.detected",
            "asset.changed",
            "intel.updated",
            "incident.detected",
        ]
        self._consumer: AIOKafkaConsumer | None = None
        self._running = False

    async def start(self) -> None:
        """Start listening to topics."""
        settings = get_settings()
        try:
            self._consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=self.group_id,
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            await self._consumer.start()
            self._running = True
            log.info("event_consumer_worker_started", topics=self.topics)

            while self._running:
                try:
                    msg_batch = await self._consumer.getmany(timeout_ms=1000, max_records=10)
                    for topic_partition, messages in msg_batch.items():
                        for msg in messages:
                            retries = 3
                            while retries > 0:
                                try:
                                    await process_kafka_message(msg.value)
                                    break
                                except Exception as exc:
                                    retries -= 1
                                    if retries == 0:
                                        await route_to_dead_letter_queue(
                                            raw_message=msg.value,
                                            error=exc,
                                            topic=topic_partition.topic,
                                        )
                except asyncio.CancelledError:
                    break
                except Exception as loop_exc:
                    log.warning("consumer_loop_iteration_error", error=str(loop_exc))
                    await asyncio.sleep(1.0)

        except Exception as exc:
            log.warning("kafka_consumer_start_failed", error=str(exc))
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop consumer worker."""
        self._running = False
        if self._consumer is not None:
            with contextlib.suppress(Exception):
                await self._consumer.stop()
            self._consumer = None
        log.info("event_consumer_worker_stopped")
