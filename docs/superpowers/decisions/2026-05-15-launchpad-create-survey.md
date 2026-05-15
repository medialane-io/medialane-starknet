# Launchpad create pages — survey (2026-05-15)

## Files

| Page | LOC | Deploys |
|---|---|---|
| `src/app/launchpad/drop/create/page.tsx` | 626 | Collection Drop (max supply, mint windows, payment tokens, public/allowlist) |
| `src/app/launchpad/nfteditions/create/page.tsx` | 428 | ERC-1155 Edition collection (CollectionStep state machine) |
| `src/app/launchpad/pop/create/page.tsx` | 427 | POP Protocol event (event-type selector, soulbound) |

## Shared structure (the small overlap)

All three:
- Use `react-hook-form` with `useForm<FormValues>` for the main form
- Have an image upload state machine: `imageFile` (File | null) + `imagePreview` (URL | null) + `imageUri` (ipfs:// | null) + `imageUploading` flag
- Upload images via `POST /api/pinata/image` (returns `{ imageUri, cid }`)
- Render the same field controls for `name` and `symbol`
- Render the final "done" success state with explorer link

## Divergent structure (the bulk of each file)

- **drop/create**: max-supply preset chips, payment-token dropdown, price-free toggle, start/end time pickers, allowlist toggle. Calls `DropFactory.create_drop` via paymaster.
- **nfteditions/create**: explicit `CollectionStep` state machine (`idle | uploading-image | uploading-metadata | deploying`) with per-step UI. Calls `ERC1155Factory.deploy_collection` via paymaster. Tracks deployment-address parsing from receipt events.
- **pop/create**: `PopEventType` (Conference / Hackathon / Meetup / …) selector, `isPublic` toggle, event-type-aware copy. Calls `POPFactory.create_collection` via paymaster.

## Pairwise diff sizes

| Pair | Diff lines |
|---|---|
| drop ↔ nfteditions | 877 |
| drop ↔ pop | 756 |
| nfteditions ↔ pop | 701 |

(Files are 427–626 LOC; the diffs being larger than the files indicates almost-no shared lines, even though the conceptual shape rhymes.)

## DECISION

**No full extraction.** The three pages deploy three different protocols with substantially different parameters and flows. Forcing a single shared `<CollectionCreateForm>` would either inflate the shared component with conditional logic or leak each protocol's parameter set across siblings — both worse than the current honest duplication.

**Worth extracting later (separate plan, not in this cleanup):** the image-upload state machine. `useImageUpload` hook returning `{ imageFile, imagePreview, imageUri, isUploading, handleFile, error }` would land in all three pages. Estimated ~40 LOC reduction per page (~120 LOC total), but the hook design needs a few choices (Pinata route URL configurable? toast handling internal or via callback? validation rules?). Defer until the dapp does enough creation flows that a fourth one is on the horizon.

## RATIONALE

Per memory `feedback_no_premature_constants.md` (the broader "don't abstract for low callsite counts" rule): three pages with three different deployment flows is at the edge of where shared abstraction starts paying off. The fact that the image-upload bit IS duplicated three ways is the strongest signal — that's where a future extraction goes. The full-page extraction would be ceremony, not value.
