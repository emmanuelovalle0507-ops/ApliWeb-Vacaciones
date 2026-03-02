"""Add HR value to user_role enum in PostgreSQL."""
from sqlalchemy import text
from app.db.session import engine

def run():
    with engine.connect() as conn:
        conn.execute(text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'HR'"))
        conn.commit()
    print("[migration] HR enum value added to user_role")

if __name__ == "__main__":
    run()
