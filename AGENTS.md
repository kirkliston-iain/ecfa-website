# ECFA website maintenance

Whenever a change adds, removes or materially changes a feature available to the general public:

1. Update `scripts/generate-public-features-guide.py` so the public guide remains accurate.
2. Run the generator and replace `public/documents/ECFA-Public-Website-Features-Guide.pdf`.
3. Verify the updated PDF visually before publishing the website change.

Private administrator-only changes do not need to be added to the public guide unless they alter what visitors can see or do.

## Cup progression maintenance

Whenever the user supplies or changes a cup route, persist the source fixture IDs in `home_winner_fixture_id` / `away_winner_fixture_id`, or the source group and position in `home_source_group_id` / `home_source_group_position` and the away equivalents. Placeholder text alone is not a draw link. Preserve the advised bracket; never infer numbered ties from kickoff dates or invent a draw. Keep direct team slots for byes.

Audit every affected later-round slot, then verify normal-time, extra-time, penalty and corrected results propagate. Use `tests/cupProgression.sql` inside its rollback transaction; never commit simulated scores. Group places resolve only after the whole group is complete; points/GD ties require the further official tiebreaks to be confirmed. Brian Latto Cup currently has no recorded fixtures or advised qualification route: do not invent one.
