"""
SQLAlchemy engine / session for project metadata.

Providers:
  - sqlite   — default local file under backend/data/
  - postgres — set DATABASE_PROVIDER=postgres and DATABASE_URL
  - memory   — in-process only (tests / emergency offline without durability)
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DATABASE_PROVIDER, DATABASE_URL

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


def _make_engine() -> Engine:
    url = DATABASE_URL
    if DATABASE_PROVIDER == "postgres" and not url:
        raise RuntimeError(
            "DATABASE_PROVIDER=postgres requires DATABASE_URL "
            "(e.g. postgresql+psycopg://user:pass@host:5432/screen_ai)"
        )
    if DATABASE_PROVIDER == "memory":
        url = "sqlite:///:memory:"

    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(url, future=True, pool_pre_ping=True, connect_args=connect_args)

    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragma(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        _engine = _make_engine()
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@contextmanager
def session_scope() -> Iterator[Session]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Create tables and run lightweight migrations."""
    # Import models so metadata is registered
    from services import project_models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    # Ensure newer columns exist on older sqlite files
    if str(engine.url).startswith("sqlite"):
        with engine.begin() as conn:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            }
            alters = {
                "timeline_json": "ALTER TABLE projects ADD COLUMN timeline_json TEXT",
                "renders_json": "ALTER TABLE projects ADD COLUMN renders_json TEXT",
                "versions_json": "ALTER TABLE projects ADD COLUMN versions_json TEXT",
            }
            for col, ddl in alters.items():
                if col not in cols:
                    conn.execute(text(ddl))


def database_enabled() -> bool:
    """False only when explicitly using memory provider without durability intent.

    memory still uses an in-process sqlite for consistency during the process lifetime.
    Callers that want 'skip DB entirely' check DATABASE_PROVIDER == 'none' — not used.
    We treat all providers as enabled; 'memory' is ephemeral sqlite.
    """
    return DATABASE_PROVIDER in ("sqlite", "postgres", "memory")


def is_durable() -> bool:
    return DATABASE_PROVIDER in ("sqlite", "postgres")
