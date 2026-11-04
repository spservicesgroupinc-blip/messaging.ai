## Task 1: Check for .env configuration
**Description:** Verify if .env exists or if environment variables need to be set based on .env.example.

**Acceptance criteria:**
- [ ] .env is created or confirmed to exist.

**Verification:**
- [ ] `.env` file is readable.

**Dependencies:** None

**Files likely touched:** .env

**Estimated scope:** XS

## Task 2: Start dev server
**Description:** Run the development server using `npm run dev` in a persistent terminal.

**Acceptance criteria:**
- [ ] Dev server starts without errors.

**Verification:**
- [ ] Server process is active.

**Dependencies:** Task 1

**Files likely touched:** None

**Estimated scope:** S

## Task 3: Verify server
**Description:** Verify the server is responsive.

**Acceptance criteria:**
- [ ] Server returns a response (e.g., 200 OK).

**Verification:**
- [ ] CURL or browser check successful.

**Dependencies:** Task 2

**Files likely touched:** None

**Estimated scope:** XS
