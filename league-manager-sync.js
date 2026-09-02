/**
 * Airtable Automation script: "Run a script" action.
 *
 * Base:            appSyUSDFEiCe4Uuc
 * Source table:    All Live Events (tbl4iC5D09JfS0t8r)
 * Source view:     viwehWqT7Z4yqK5Rp
 * Lookup table:    League Manager (tblVZGUzFobq1p1kf)
 *
 * For every record in the source view, this looks up the record(s) in
 * League Manager whose `leagueFullName` matches the source record's
 * `League Name`. If exactly one League Manager record matches, every
 * BLANK field in FIELD_MAPPINGS on the source record is filled in from
 * the corresponding League Manager field. Fields that already have a
 * value are never touched.
 *
 * Trigger setup (done in the Airtable Automations UI, not in this file):
 *   1. Trigger: "At a scheduled time".
 *   2. Repeat every 15 minutes (Every 15 minutes / custom interval,
 *      depending on your plan's scheduling options).
 *   3. Action: "Run a script" with this file's contents pasted in.
 * This script does not control its own run frequency - that is entirely
 * up to the automation's trigger configuration.
 */

const SOURCE_TABLE_NAME = "All Live Events";
const SOURCE_VIEW_ID = "viwehWqT7Z4yqK5Rp";
const LOOKUP_TABLE_NAME = "League Manager";

const JOIN_FIELD_SOURCE = "League Name";
const JOIN_FIELD_LOOKUP = "leagueFullName";
const MATCH_FIELD_NAME = "Match (first team listed is home)";

// target field (in All Live Events) <- lookup field (in League Manager)
// type is one of: "singleSelect", "multipleSelects", "number", "text"
const FIELD_MAPPINGS = [
    { target: "League Abbr", lookup: "league", type: "singleSelect" },
    { target: "P+ Geo Region", lookup: "geoCountries", type: "multipleSelects" },
    { target: "Organization", lookup: "Org Name", type: "singleSelect" },
    { target: "Tier", lookup: "Tier", type: "singleSelect" },
    { target: "AWS Region", lookup: "AWS Region", type: "singleSelect" },
    { target: "Custom Output", lookup: "Custom Output (standard)", type: "singleSelect" },
    { target: "Encryption Type", lookup: "encryption", type: "singleSelect" },
    { target: "Primary Category", lookup: "pcategoryName", type: "text" },
    { target: "Slate URL", lookup: "adsBlackoutImage", type: "singleSelect" },
    { target: "Distribution Partners", lookup: "Distribution Partners", type: "multipleSelects" },
    { target: "Propeller org", lookup: "orgId", type: "text" },
    { target: "Vtags", lookup: "vTags", type: "text" },
    { target: "Projected PCV", lookup: "Projected PCV per event", type: "number" },
];

function isBlankValue(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "string") return value.trim() === "";
    return false;
}

function selectText(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;
    if (typeof rawValue === "object" && !Array.isArray(rawValue) && rawValue.name) {
        return rawValue.name;
    }
    return String(rawValue).trim() || null;
}

function findChoiceCaseInsensitive(choiceNames, text) {
    if (choiceNames.has(text)) return text;
    const lower = text.trim().toLowerCase();
    for (const choice of choiceNames) {
        if (choice.trim().toLowerCase() === lower) return choice;
    }
    return null;
}

const liveEventsTable = base.getTable(SOURCE_TABLE_NAME);
const leagueManagerTable = base.getTable(LOOKUP_TABLE_NAME);
const sourceView = liveEventsTable.getView(SOURCE_VIEW_ID);

const targetFieldsNeeded = [MATCH_FIELD_NAME, JOIN_FIELD_SOURCE, ...FIELD_MAPPINGS.map((m) => m.target)];
const lookupFieldsNeeded = [JOIN_FIELD_LOOKUP, ...FIELD_MAPPINGS.map((m) => m.lookup)];

const sourceQuery = await sourceView.selectRecordsAsync({ fields: targetFieldsNeeded });
const lookupQuery = await leagueManagerTable.selectRecordsAsync({ fields: lookupFieldsNeeded });

// Pre-compute each target select/multi-select field's valid choice names,
// so we only ever write values that already exist as options.
const targetFieldChoiceNames = new Map();
for (const mapping of FIELD_MAPPINGS) {
    const field = liveEventsTable.getField(mapping.target);
    if (field.type === "singleSelect" || field.type === "multipleSelects") {
        targetFieldChoiceNames.set(mapping.target, new Set(field.options.choices.map((c) => c.name)));
    }
}

// Group League Manager records by normalized leagueFullName so we can
// detect "exactly one match" vs. zero or multiple matches.
const lookupByLeagueName = new Map();
for (const record of lookupQuery.records) {
    const name = selectText(record.getCellValue(JOIN_FIELD_LOOKUP));
    if (!name) continue;
    const key = name.toLowerCase();
    if (!lookupByLeagueName.has(key)) lookupByLeagueName.set(key, []);
    lookupByLeagueName.get(key).push(record);
}

const updates = [];
let noMatchCount = 0;
let multipleMatchCount = 0;

console.log(`Found ${sourceQuery.records.length} record(s) in view.`);

for (const record of sourceQuery.records) {
    const matchName = selectText(record.getCellValue(MATCH_FIELD_NAME)) || "(blank)";
    const leagueName = selectText(record.getCellValue(JOIN_FIELD_SOURCE));

    console.log(`--- Record ${record.id}: Match="${matchName}" League Name="${leagueName || "(blank)"}" ---`);
    for (const mapping of FIELD_MAPPINGS) {
        const currentValue = record.getCellValue(mapping.target);
        const blank = isBlankValue(currentValue);
        console.log(`  ${mapping.target}: ${blank ? "EMPTY" : "NOT EMPTY"}${blank ? "" : ` (value: ${JSON.stringify(currentValue)})`}`);
    }

    if (!leagueName) {
        console.log(`  -> Skipping: "${JOIN_FIELD_SOURCE}" is blank on this record.`);
        continue;
    }

    const matches = lookupByLeagueName.get(leagueName.toLowerCase());
    if (!matches || matches.length === 0) {
        noMatchCount++;
        console.log(`  -> Skipping: no League Manager record has "${JOIN_FIELD_LOOKUP}" = "${leagueName}".`);
        continue;
    }
    if (matches.length > 1) {
        multipleMatchCount++;
        console.log(`  -> Skipping: ${matches.length} League Manager records match "${leagueName}" (need exactly 1).`);
        continue;
    }

    const lookupRecord = matches[0];
    const fieldsToUpdate = {};

    for (const mapping of FIELD_MAPPINGS) {
        if (!isBlankValue(record.getCellValue(mapping.target))) continue;

        const rawValue = lookupRecord.getCellValue(mapping.lookup);
        if (isBlankValue(rawValue)) continue;

        if (mapping.type === "singleSelect") {
            const text = selectText(rawValue);
            if (!text) continue;
            const choiceNames = targetFieldChoiceNames.get(mapping.target);
            const matchedChoice = findChoiceCaseInsensitive(choiceNames, text);
            if (matchedChoice) {
                fieldsToUpdate[mapping.target] = { name: matchedChoice };
            } else {
                console.log(`Record ${record.id}: no "${mapping.target}" choice matching "${text}", skipping field`);
            }
        } else if (mapping.type === "multipleSelects") {
            const rawNames = Array.isArray(rawValue)
                ? rawValue.map((v) => v.name)
                : String(rawValue).split(",").map((s) => s.trim()).filter(Boolean);
            const choiceNames = targetFieldChoiceNames.get(mapping.target);
            const matchedNames = [];
            for (const name of rawNames) {
                const matchedChoice = findChoiceCaseInsensitive(choiceNames, name);
                if (matchedChoice) {
                    matchedNames.push(matchedChoice);
                } else {
                    console.log(`Record ${record.id}: no "${mapping.target}" choice matching "${name}", skipping value`);
                }
            }
            if (matchedNames.length > 0) {
                fieldsToUpdate[mapping.target] = matchedNames.map((name) => ({ name }));
            }
        } else if (mapping.type === "number") {
            const number = typeof rawValue === "number" ? rawValue : Number(rawValue);
            if (Number.isFinite(number)) {
                fieldsToUpdate[mapping.target] = number;
            } else {
                console.log(`Record ${record.id}: "${mapping.lookup}" value "${rawValue}" is not a valid number, skipping "${mapping.target}"`);
            }
        } else if (mapping.type === "text") {
            const text = selectText(rawValue);
            if (text) {
                fieldsToUpdate[mapping.target] = text;
            }
        } else {
            console.log(`Record ${record.id}: unknown mapping type "${mapping.type}" for "${mapping.target}", skipping field`);
        }
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
        console.log(`  -> Filling: ${JSON.stringify(fieldsToUpdate)}`);
        updates.push({ id: record.id, fields: fieldsToUpdate });
    } else {
        console.log(`  -> Nothing to fill (all mapped fields already had a value, or no blank field had a usable lookup value).`);
    }
}

for (let i = 0; i < updates.length; i += 50) {
    await liveEventsTable.updateRecordsAsync(updates.slice(i, i + 50));
}

console.log(`Updated ${updates.length} record(s).`);
console.log(`Skipped ${noMatchCount} record(s) with no League Manager match.`);
console.log(`Skipped ${multipleMatchCount} record(s) with multiple League Manager matches.`);
