"""Pytest fixtures — mongomock database for service tests."""
from __future__ import annotations

import pytest
import mongomock


@pytest.fixture
def mongo_client():
    return mongomock.MongoClient()


@pytest.fixture
def mongo_db(mongo_client):
    return mongo_client["test_submgr"]
