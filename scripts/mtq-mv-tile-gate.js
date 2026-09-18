// Airtable Automation "Run a script" action.
// Automation: Multiview Assigned Automation (wfll9oPj468jqrdL3)
// Trigger: record updated on 'All Live Events' (tbl4iC5D09JfS0t8r), watching
//          'Multiview - Tile - Quadrant' (fld9sKtCaVA4WQ3Lk).
// Reads the record fresh from the view:
//   https://airtable.com/appSyUSDFEiCe4Uuc/tbl4iC5D09JfS0t8r/viw66aYpB9SRsv40l
//
// REQUIRED SETUP: in this script step's Input Variables, add a variable named
// `recordId` and set its value to the dynamic "Record ID" token from the
// trigger step. Without that, config.recordId is undefined and
// view.selectRecordAsync throws.
//
// Only continues if one of these MV1 tile sets is fully selected:
//   - all 4: MV1 - 4T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom Left) / Tile 4 (Bottom Right)
//   - all 3: MV1 - 3T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom)
//   - all 2: MV1 - 2T - Tile 1 (Left) / Tile 2 (Right)
// When it continues, also outputs `mtqList`: the selected option names for the matched set.

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

const config = input.config();
if (!config.recordId) {
    throw new Error(
        "Missing input variable `recordId` - map it to the trigger record's Record ID in this script step's Input Variables."
    );
}

const table = base.getTable(TABLE_ID);
const view = table.getView(VIEW_ID);
const record = await view.selectRecordAsync(config.recordId, { fields: [FIELD_NAME] });

if (!record) {
    // Record was updated but isn't in this view (e.g. filtered out) - nothing to gate on.
    output.set("shouldContinue", false);
} else {
    const selected = (record.getCellValue(FIELD_NAME) || []).map((choice) => choice.name);

    function allSelected(optionNames) {
        return optionNames.every((name) => selected.includes(name));
    }

    const hasFourTiles = allSelected(FOUR_TILE);
    const hasThreeTiles = allSelected(THREE_TILE);
    const hasTwoTiles = allSelected(TWO_TILE);

    if (!(hasFourTiles || hasThreeTiles || hasTwoTiles)) {
        output.set("shouldContinue", false);
    } else {
        const matched = hasFourTiles ? FOUR_TILE : hasThreeTiles ? THREE_TILE : TWO_TILE;
        output.set("shouldContinue", true);
        output.set("mtqList", matched);
    }
}
