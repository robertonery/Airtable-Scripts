// Airtable Automation "Run a script" action.
//
// Only continues the automation if `mtq` has one of these MV tile sets fully present:
//   - all 4: MV1T, MV2T, MV3T, MV4T
//   - all 3: MV1T, MV2T, MV3T
//   - all 2: MV1T, MV2T
// When it continues, also outputs `mtqList`: the mtq values for the matched tile set.
//
// Rename MV_FIELDS / the `mtq` lookup below to match your actual field/variable names
// before pasting this into the base.

const MV_FIELDS = ["MV1T", "MV2T", "MV3T", "MV4T"];

const config = input.config();
const mtq = config.mtq; // record fields object, e.g. { MV1T: "...", MV2T: "...", ... }

function isPresent(value) {
    return value !== null && value !== undefined && value !== "";
}

function allPresent(fieldNames) {
    return fieldNames.every((fieldName) => isPresent(mtq[fieldName]));
}

const hasFourTiles = allPresent(MV_FIELDS.slice(0, 4));
const hasThreeTiles = allPresent(MV_FIELDS.slice(0, 3));
const hasTwoTiles = allPresent(MV_FIELDS.slice(0, 2));

if (!(hasFourTiles || hasThreeTiles || hasTwoTiles)) {
    output.set("shouldContinue", false);
    return;
}

const matchedFields = hasFourTiles
    ? MV_FIELDS.slice(0, 4)
    : hasThreeTiles
    ? MV_FIELDS.slice(0, 3)
    : MV_FIELDS.slice(0, 2);

output.set("shouldContinue", true);
output.set("mtqList", matchedFields.map((fieldName) => mtq[fieldName]));
