-- Rollback chain_type migration

-- Step 1: Delete non-EVM networks
DELETE FROM networks WHERE chain_type IN ('solana', 'sui', 'ton');

-- Step 2: Drop indexes
ALTER TABLE networks DROP INDEX idx_chain_type_slug;
ALTER TABLE networks DROP INDEX idx_chain_type;

-- Step 3: Restore unique constraint on chain_id
ALTER TABLE networks ADD UNIQUE INDEX chain_id (chain_id);

-- Step 4: Make chain_id NOT NULL again
ALTER TABLE networks MODIFY COLUMN chain_id INT NOT NULL;

-- Step 5: Drop chain_type column
ALTER TABLE networks DROP COLUMN chain_type;
