package tab

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var allowedEntities = []string{"field"}

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.tab WHERE id = $1`, id)
	return err
}

func Get(entity string, entityId uuid.UUID) ([]types.Tab, error) {
	tabs := make([]types.Tab, 0)

	if !tools.StringInSlice(entity, allowedEntities) {
		return tabs, errors.New("bad entity")
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, state
		FROM app.tab
		WHERE %s_id = $1
		ORDER BY position ASC
	`, entity), entityId)
	if err != nil {
		return tabs, err
	}
	defer rows.Close()

	for rows.Next() {
		var t types.Tab
		if err := rows.Scan(&t.Id, &t.State); err != nil {
			return tabs, err
		}
		tabs = append(tabs, t)
	}

	for i, tab := range tabs {
		tab.Captions, err = caption.Get("tab", tab.Id, []string{"tabTitle"})
		if err != nil {
			return tabs, err
		}
		tabs[i] = tab
	}
	return tabs, nil
}

func Set_tx(tx pgx.Tx, entity string, entityId uuid.UUID, position int, tab types.Tab) (uuid.UUID, error) {
	if !tools.StringInSlice(entity, allowedEntities) {
		return tab.Id, errors.New("bad entity")
	}

	known, err := schema.CheckCreateId_tx(tx, &tab.Id, "tab", "id")
	if err != nil {
		return tab.Id, err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.tab
			SET position = $1, state = $2
			WHERE id = $3
		`, position, tab.State, tab.Id); err != nil {
			return tab.Id, err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			INSERT INTO app.tab (id, %s_id, position, state)
			VALUES ($1,$2,$3,$4)
		`, entity), tab.Id, entityId, position, tab.State); err != nil {
			return tab.Id, err
		}
	}
	return tab.Id, caption.Set_tx(tx, tab.Id, tab.Captions)
}
