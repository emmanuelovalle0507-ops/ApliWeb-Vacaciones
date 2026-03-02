from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_and_verify_password() -> None:
    plain = "super-secret"
    hashed = hash_password(plain)

    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("bad-password", hashed)


def test_create_and_decode_access_token() -> None:
    token = create_access_token(subject="user-123", role="EMPLOYEE")
    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert payload["role"] == "EMPLOYEE"
    assert "exp" in payload
