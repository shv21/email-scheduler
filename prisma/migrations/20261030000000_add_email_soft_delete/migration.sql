-- AlterTable
ALTER TABLE "emails" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "emails_deleted_at_idx" ON "emails"("deleted_at");
