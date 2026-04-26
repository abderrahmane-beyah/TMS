"""replace clarke_wright with heuristique

Revision ID: 825ec0aed3b4
Revises: 46cc9478f48e
Create Date: 2026-04-26 23:45:27.252445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '825ec0aed3b4'
down_revision: Union[str, Sequence[str], None] = '46cc9478f48e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("ALTER TYPE algorithmeenum RENAME VALUE 'CLARKE_WRIGHT' TO 'HEURISTIQUE'")

def downgrade():
    op.execute("ALTER TYPE algorithmeenum RENAME VALUE 'HEURISTIQUE' TO 'CLARKE_WRIGHT'")