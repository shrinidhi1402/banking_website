"""Connector abstractions — abstract base + Qualys/Tenable/Splunk/Mock."""

from crq.ingestion.connectors.base import BaseConnector
from crq.ingestion.connectors.mock import MockConnector
from crq.ingestion.connectors.qualys import QualysConnector
from crq.ingestion.connectors.splunk import SplunkConnector
from crq.ingestion.connectors.tenable import TenableConnector

__all__ = [
    "BaseConnector",
    "MockConnector",
    "QualysConnector",
    "TenableConnector",
    "SplunkConnector",
]
