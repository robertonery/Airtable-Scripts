# League Manager sync script

`league-manager-sync.js` is an Airtable Automation "Run a script" action for
base `appSyUSDFEiCe4Uuc`.

## What it does

For every record in the **All Live Events** view
[`viwehWqT7Z4yqK5Rp`](https://airtable.com/appSyUSDFEiCe4Uuc/tbl4iC5D09JfS0t8r/viwehWqT7Z4yqK5Rp),
it looks up the **League Manager** record
([`tblVZGUzFobq1p1kf`](https://airtable.com/appSyUSDFEiCe4Uuc/tblVZGUzFobq1p1kf))
whose `leagueFullName` matches the record's `League Name`. If exactly one
League Manager record matches, it fills in every currently-**blank** field
below from that record. Fields that already have a value are never
overwritten, and records with zero or more than one matching League
Manager record are skipped (and logged) entirely.

| All Live Events field (filled) | League Manager field (source) | Type |
| --- | --- | --- |
| League Abbr | league | singleSelect |
| P+ Geo Region | geoCountries | multipleSelects |
| Organization | Org Name | singleSelect |
| Tier | Tier | singleSelect |
| AWS Region | AWS Region | singleSelect |
| Custom Output | Custom Output (standard) | singleSelect |
| Encryption Type | encryption | singleSelect |
| Primary Category | pcategoryName | text |
| Slate URL | adsBlackoutImage | singleSelect |
| Distribution Partners | Distribution Partners | multipleSelects |
| Propeller org | orgId | text |
| Vtags | vTags | text |
| Projected PCV | Projected PCV per event | number |

For `singleSelect`/`multipleSelects` mappings, the target fields all have
fixed choice lists. The script only ever writes a value that already
exists as a choice on the target field (case-insensitive match); if no
matching choice exists it logs a message and leaves that field blank
rather than erroring out or silently miswriting data. `geoCountries` is a
plain comma-separated string (e.g. `"US,AU,BR,LATAM"`) and gets split into
the individual `P+ Geo Region` choices.

`text` mappings copy the League Manager value as-is into a plain text
field. `number` mappings (`Projected PCV`) parse the source value as a
number and skip the field (logging why) if it isn't a valid number.

### Exception: Brazil Projected PCV

When a record's **Match (first team listed is home)** contains `(BRA)` and
its **P+ Geo Region** includes `BR` (either the value already on the
record, or the value about to be filled in from `geoCountries` this run),
**Projected PCV** is set to a flat **40,000** instead of League Manager's
`Projected PCV per event` value. This only fires when Projected PCV is
still blank on the record — like every other field, an existing value is
never overwritten.

## Debugging / reading the run log

Every run prints a full diagnostic trace to the automation's run history
(the "run script" step's output panel), for every record in the view -
not just the ones that get updated:

```
Found 2 record(s) in view.
--- Record recXXXXXXXXXXXXXX: Match="Team A vs Team B" League Name="UFC" ---
  League Abbr: EMPTY
  P+ Geo Region: EMPTY
  Organization: NOT EMPTY (value: {"id":"sel...","name":"UFC","color":"grayLight2"})
  ...
  -> Filling: {"League Abbr":{"name":"UFC"}, ...}
```

Each record logs its `Match` and `League Name`, then the EMPTY/NOT EMPTY
status (and current value, if any) of every field in `FIELD_MAPPINGS`,
followed by why it was skipped (blank League Name, no League Manager
match, multiple League Manager matches) or what it filled. Open the
automation's run history in Airtable and click into a run to see this
output.

## Setting it up in Airtable

1. Open the **All Live Events** table > Automations > create a new
   automation.
2. Trigger: **At a scheduled time**, repeating every 15 minutes.
3. Action: **Run a script**, paste in the contents of
   `league-manager-sync.js`.
4. Test and turn the automation on.

The run frequency lives entirely in the trigger configuration in step 2 -
the script itself has no knowledge of, or control over, how often it runs.
