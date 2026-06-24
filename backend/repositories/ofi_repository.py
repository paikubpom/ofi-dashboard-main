import pandas as pd
from typing import List, Dict, Any, Optional
from backend.core.database import DatabaseManager, db_manager

class OFIRepository:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def get_published_data(self, allowed_files: List[str], owner_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch all published OFI items from database that belong to the allowed files.
        Optionally filters by elementOwnerId if owner_id is provided.
        """
        if not allowed_files:
            return []

        conn = self.db.get_connection()
        try:
            placeholders = ",".join(["?"] * len(allowed_files))
            if owner_id:
                query = f"SELECT * FROM published_data WHERE _source_file IN ({placeholders}) AND (elementOwnerId = ? OR INSTR(elementOwnerId, ?))"
                df = pd.read_sql_query(query, conn, params=allowed_files + [owner_id, owner_id])
            else:
                query = f"SELECT * FROM published_data WHERE _source_file IN ({placeholders})"
                df = pd.read_sql_query(query, conn, params=allowed_files)

            # Convert NaN to None for JSON compliance
            df = df.astype(object).where(pd.notnull(df), None)
            return df.to_dict(orient="records")
        except Exception as e:
            print(f"[OFIRepository.get_published_data Error]: {e}")
            return []
        finally:
            conn.close()

    def get_active_owners(self) -> List[str]:
        """Fetch distinct elementOwnerId values that exist in the database."""
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            # Determine table name
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='published_data'")
            table_name = "published_data" if cursor.fetchone() else "ofi_improvements"
            
            cursor.execute(
                f"SELECT DISTINCT elementOwnerId FROM {table_name} "
                "WHERE elementOwnerId IS NOT NULL AND elementOwnerId != '' "
                "ORDER BY elementOwnerId ASC"
            )
            return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"[OFIRepository.get_active_owners Error]: {e}")
            return []
        finally:
            conn.close()

    def get_sqlite_distinct_owners(self) -> List[str]:
        """Fetch distinct elementOwnerId from published_data for owner listings."""
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='published_data'")
            if cursor.fetchone():
                cursor.execute(
                    "SELECT DISTINCT elementOwnerId FROM published_data "
                    "WHERE elementOwnerId IS NOT NULL AND elementOwnerId != ''"
                )
                return [row[0] for row in cursor.fetchall()]
            return []
        except Exception as e:
            print(f"[OFIRepository.get_sqlite_distinct_owners Error]: {e}")
            return []
        finally:
            conn.close()
