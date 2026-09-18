// Airtable Automation "Run a script" action.
// Automation: Multiview Assigned Automation (wfll9oPj468jqrdL3)
// Trigger: record updated on 'All Live Events' (tbl4iC5D09JfS0t8r), watching
//          'Multiview - Tile - Quadrant' (fld9sKtCaVA4WQ3Lk).
// Reads every record straight from the view:
//   https://airtable.com/appSyUSDFEiCe4Uuc/tbl4iC5D09JfS0t8r/viw66aYpB9SRsv40l
//
// For each record, only counts it as passing if one of these MV1 tile sets is
// fully selected:
//   - all 4: MV1 - 4T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom Left) / Tile 4 (Bottom Right)
//   - all 3: MV1 - 3T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom)
//   - all 2: MV1 - 2T - Tile 1 (Left) / Tile 2 (Right)
//
// Outputs `shouldContinue` (true if at least one record passes) and `mtqList`:
// an array of { recordId, mtq } for every record that passed, where `mtq` is
// the selected option names for that record's matched tile set.

const TABLE_ID = "tbl4iC5D09JfS0t8r";
const VIEW_ID = "viw66aYpB9SRsv40l";
const FIELD_NAME = "Multiview - Tile - Quadrant";

const FOUR_TILE = [
    "MV1 - 4T - Tile 1 (Top Left)",
    "MV1 - 4T - Tile 2 (Top Right)",
    "MV1 - 4T - Tile 3 (Bottom Left)",
    "MV1 - 4T - Tile 4 (Bottom Right)",
];
const THREE_TILE = [
    "MV1 - 3T - Tile 1 (Top Left)",
    "MV1 - 3T - Tile 2 (Top Right)",
    "MV1 - 3T - Tile 3 (Bottom)",
];
const TWO_TILE = ["MV1 - 2T - Tile 1 (Left)", "MV1 - 2T - Tile 2 (Right)"];

function allSelected(selected, optionNames) {
    return optionNames.every((name) => selected.includes(name));
}

const table = base.getTable(TABLE_ID);
const view = table.getView(VIEW_ID);
const queryResult = await view.selectRecordsAsync({ fields: [FIELD_NAME] });

const mtqList = [];
for (const record of queryResult.records) {
    const selected = (record.getCellValue(FIELD_NAME) || []).map((choice) => choice.name);

    const hasFourTiles = allSelected(selected, FOUR_TILE);
    const hasThreeTiles = allSelected(selected, THREE_TILE);
    const hasTwoTiles = allSelected(selected, TWO_TILE);

    if (hasFourTiles || hasThreeTiles || hasTwoTiles) {
        const matched = hasFourTiles ? FOUR_TILE : hasThreeTiles ? THREE_TILE : TWO_TILE;
        mtqList.push({ recordId: record.id, mtq: matched });
    }
}

output.set("shouldContinue", mtqList.length > 0);
output.set("mtqList", mtqList);
