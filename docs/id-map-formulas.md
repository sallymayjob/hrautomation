# Auto-generated ID scheme and cross-sheet ID map (Google Sheets named formulas)

Yes — this can be done as **Named Functions** (Google Sheets), so you can reuse one formula definition and keep sheet cells clean.

## 1) Create reusable Named Functions

In Google Sheets, go to:
`Data` → `Named functions` → `Add new function`

Create the following.

### A) `AUTO_ID`

**Name**: `AUTO_ID`  
**Description**: Build a stable ID from prefix + date + row number.  
**Arguments**:
- `prefix`
- `date_value`
- `row_num`

**Formula definition**:

```gs
=prefix & "-" & TEXT(date_value,"yyyymmdd") & "-" & TEXT(row_num,"0000")
```

---

### B) `ID_MAP`

**Name**: `ID_MAP`  
**Description**: Combine onboarding and training IDs into one live map.  
**Arguments**:
- `on_name_rng`
- `on_id_rng`
- `on_person_rng`
- `on_email_rng`
- `tr_name_rng`
- `tr_id_rng`
- `tr_person_rng`
- `tr_email_rng`

**Formula definition**:

```gs
=QUERY(
  {
    IF(on_name_rng="",,"onboarding"), on_id_rng, on_person_rng, on_email_rng;
    IF(tr_name_rng="",,"training"), tr_id_rng, tr_person_rng, tr_email_rng
  },
  "where Col2 is not null",
  0
)
```

## 2) Use Named Function for onboarding IDs

Assumptions:
- Onboarding columns match `sheets/onboarding.csv`.
- `onboarding_id` is column `A`.
- Name/driver column is `B` (`employee_name`).
- `start_date` is column `H`.

Put this in `Onboarding!A1`:

```gs
={"onboarding_id";
  ARRAYFORMULA(
    IF(B2:B="",,
      AUTO_ID("OB", H2:H, ROW(B2:B)-1)
    )
  )
}
```

Pattern: `OB-20260303-0001`.

## 3) Use Named Function for training IDs

Assumptions:
- Training columns match `sheets/training.csv`.
- Add a new first column `A` named `training_id`.
- Existing `UserID` shifts from `A` to `B`.
- `Joined Date` is column `H`.

Put this in `Training!A1`:

```gs
={"training_id";
  ARRAYFORMULA(
    IF(B2:B="",,
      AUTO_ID("TR", H2:H, ROW(B2:B)-1)
    )
  )
}
```

Pattern: `TR-20260309-0001`.

## 4) Build the combined ID map with Named Function

Create tab `ID_MAP` and put this in `ID_MAP!A1`:

```gs
={"source","generated_id","person_key","email";
  ID_MAP(
    Onboarding!B2:B, Onboarding!A2:A, Onboarding!C2:C, Onboarding!D2:D,
    Training!B2:B,   Training!A2:A,   Training!B2:B,   Training!D2:D
  )
}
```

This stays auto-updated whenever either sheet gets new rows.

## 5) Optional duplicate check

Put this in `ID_MAP!F1`:

```gs
={"duplicate_id_count";
  ARRAYFORMULA(IF(B2:B="",,COUNTIF(B2:B,B2:B)))
}
```

Any value `>1` indicates a duplicate generated ID.

## Notes
- This is formula-only (no Apps Script).
- If you sort rows frequently, use a frozen `created_at` timestamp column as the date input for `AUTO_ID` to keep IDs immutable.
