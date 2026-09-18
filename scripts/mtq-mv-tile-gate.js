// Airtable Automation "Run a script" action.
// Automation: Multiview Assigned Automation (wfll9oPj468jqrdL3)
// Trigger: record updated on 'All Live Events' (tbl4iC5D09JfS0t8r), watching
//          'Multiview - Tile - Quadrant' (fld9sKtCaVA4WQ3Lk).
//
// In this script step's Input Variables, add a variable named `mtq` mapped to
// the trigger record's 'Multiview - Tile - Quadrant' field (Automation passes
// multipleSelects fields in as an array of the selected option names).
//
// Only continues if one of these MV1 tile sets is fully selected:
//   - all 4: MV1 - 4T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom Left) / Tile 4 (Bottom Right)
//   - all 3: MV1 - 3T - Tile 1 (Top Left) / Tile 2 (Top Right) / Tile 3 (Bottom)
//   - all 2: MV1 - 2T - Tile 1 (Left) / Tile 2 (Right)
// When it continues, also outputs `mtqList`: the selected option names for the matched set.

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
const selected = config.mtq || [];

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
