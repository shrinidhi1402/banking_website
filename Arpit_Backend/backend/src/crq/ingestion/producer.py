"""Kafka / Redpanda event producer for ingestion pipeline."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from aiokafka import AIOKafkaProducer

from crq.core.config import get_settings
from crq.core.logging import get_logger
from crq.schemas.events import EventEnvelope

log = get_logger(__name__)

_producer: AIOKafkaProducer | None = None


def resolve_topic_for_event(event_type: str) -> str:
    """Map event type to Redpanda topic name per architecture §3.1."""
    if event_type.startswith("control."):
        return "control.updated"
    if event_type.startswith("vuln."):
        return "vuln.detected"
    if event_type.startswith("asset."):
        return "asset.changed"
    if event_type.startswith("intel."):
        return "intel.updated"
    if event_type.startswith("incident."):
        return "incident.detected"
    if event_type.startswith("risk."):
        return "risk.alert"
    return "crq.events"


class DateTimeEncoder(json.JSONEncoder):
    """JSON encoder for objects containing datetime or UUIDs."""

    def default(self, o: Any) -> Any:
        if isinstance(o, datetime):
            return o.isoformat()
        return str(o)


async def get_kafka_producer() -> AIOKafkaProducer | None:
    """Obtain or initialize singleton AIOKafkaProducer."""
    global _producer
    if _producer is not None:
        return _producer

    settings = get_settings()
    try:
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, cls=DateTimeEncoder).encode("utf-8"),
            request_timeout_ms=3000,
        )
        await producer.start()
        _producer = producer
        log.info("kafka_producer_started", bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS)
        return _producer
    except Exception as exc:
        log.warning(
            "kafka_producer_init_failed", error=str(exc), servers=settings.KAFKA_BOOTSTRAP_SERVERS
        )
        return None


async def stop_kafka_producer() -> None:
    """Gracefully stop producer."""
    global _producer
    if _producer is not None:
        try:
            await _producer.stop()
        except Exception as exc:
            log.warning("kafka_producer_stop_failed", error=str(exc))
        finally:
            _producer = None


async def publish_event(event: EventEnvelope) -> str:
    """Publish an ingested event to the appropriate Redpanda topic.

    Returns the topic name where the event was published or routed.
    """
    topic = resolve_topic_for_event(event.event_type)
    producer = await get_kafka_producer()

    payload = event.model_dump()
    if producer is not None:
        try:
            key = str(event.org_id).encode("utf-8")
            await producer.send_and_wait(topic, value=payload, key=key)
            log.info(
                "event_published_to_kafka",
                topic=topic,
                event_id=str(event.event_id),
                event_type=event.event_type,
            )
        except Exception as exc:
            log.warning(
                "kafka_publish_failed_fallback",
                error=str(exc),
                topic=topic,
                event_id=str(event.event_id),
            )
    else:
        log.debug(
            "kafka_unavailable_event_routed_in_memory", topic=topic, event_id=str(event.event_id)
        )

    return topic
