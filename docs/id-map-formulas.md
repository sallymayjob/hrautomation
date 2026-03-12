# Auto-generated ID scheme and cross-sheet ID map (OB 001 increment format)

This version uses one simple format everywhere:

- `OB 001`
- `OB 002`
- `OB 003`
- ...

No Apps Script required.

## 1) Onboarding sheet (`onboarding_id` in column A)

Assumptions:
- `Onboarding!B` is your driver column (for example `employee_name`).
- `onboarding_id` is in `Onboarding!A`.

Put this in `Onboarding!A1`:

```gs
={"onboarding_id";
  ARRAYFORMULA(
    IF(B2:B="",,
      "OB " & TEXT(ROW(B2:B)-1,"000")
    )
  )
}
```

This gives `OB 001`, `OB 002`, `OB 003`, ... for onboarding rows.

## 2) Training sheet (`training_id` in new column A)

Assumptions:
- Add a new first column `A` named `training_id`.
- Existing `UserID` shifts from `A` to `B`.
- `Training!B` is your driver column.

To keep IDs unique across both sheets, training starts after onboarding count.

Put this in `Training!A1`:

```gs
={"training_id";
  ARRAYFORMULA(
    IF(B2:B="",,
      "OB " & TEXT(COUNTA(Onboarding!B2:B) + ROW(B2:B)-1,"000")
    )
  )
}
```

Example: if onboarding has 25 populated rows, first training row becomes `OB 026`.

## 3) Combined ID map tab

Create a tab named `ID_MAP` and put this in `ID_MAP!A1`:

```gs
={"source","generated_id","person_key","email";
  QUERY(
    {
      IF(Onboarding!B2:B="",,"onboarding"), Onboarding!A2:A, Onboarding!C2:C, Onboarding!D2:D;
      IF(Training!B2:B="",,"training"),   Training!A2:A,   Training!B2:B,   Training!D2:D
    },
    "where Col2 is not null",
    0
  )
}
```

This keeps a live map of all IDs from both sheets.

## 4) Optional duplicate check

Put this in `ID_MAP!F1`:

```gs
={"duplicate_id_count";
  ARRAYFORMULA(IF(B2:B="",,COUNTIF(B2:B,B2:B)))
}
```

Any value greater than `1` means a duplicate ID.

## Notes
- IDs are formula-generated and update automatically as rows are added.
- If rows are re-ordered or deleted, row-based IDs can shift. If you need immutable IDs, paste values after generation or use a frozen helper index column.
