import re
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

DISPLAY_ID_PREFIX = "miioo_"
DISPLAY_ID_DIGITS = 6
DISPLAY_ID_PATTERN = re.compile(r"^miioo_\d{6}$")
DEFAULT_MAX_ATTEMPTS = 50


def build_display_id_from_digits(digits: str) -> str:
    normalized = "".join(ch for ch in str(digits) if ch.isdigit())
    if len(normalized) != DISPLAY_ID_DIGITS:
        raise ValueError("display id digits must be exactly 6 numeric characters")
    return f"{DISPLAY_ID_PREFIX}{normalized}"


def build_random_display_id() -> str:
    return build_display_id_from_digits(f"{secrets.randbelow(10 ** DISPLAY_ID_DIGITS):0{DISPLAY_ID_DIGITS}d}")


def is_valid_display_id(value: str | None) -> bool:
    if not value:
        return False
    return DISPLAY_ID_PATTERN.fullmatch(value) is not None


async def _display_id_exists(
    db: AsyncSession,
    display_id: str,
    *,
    exclude_user_id=None,
) -> bool:
    stmt = select(User.id).where(User.display_id == display_id)
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    result = await db.execute(stmt.limit(1))
    return result.scalar_one_or_none() is not None


async def generate_unique_display_id(
    db: AsyncSession,
    *,
    exclude_user_id=None,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> str:
    for _ in range(max_attempts):
        candidate = build_random_display_id()
        if not await _display_id_exists(db, candidate, exclude_user_id=exclude_user_id):
            return candidate
    raise RuntimeError("failed to generate a unique user display_id")


async def ensure_user_display_id(
    user: User,
    db: AsyncSession,
    *,
    commit: bool = True,
    refresh: bool = True,
) -> str:
    if is_valid_display_id(user.display_id):
        return str(user.display_id)

    user.display_id = await generate_unique_display_id(db, exclude_user_id=user.id)
    if commit:
        await db.commit()
    if refresh:
        await db.refresh(user)
    return str(user.display_id)
