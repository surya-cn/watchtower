-- CreateEnum
CREATE TYPE "Source" AS ENUM ('reddit', 'twitter', 'ea_forum', 'steam', 'discord');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('new', 'active', 'escalated', 'fixed', 'closed_false_positive', 'resolved');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('viewer', 'editor', 'admin');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_posts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "source_post_id" TEXT NOT NULL,
    "author" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cluster_id" TEXT,

    CONSTRAINT "raw_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_clusters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'low',
    "status" "Status" NOT NULL DEFAULT 'new',
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "priority_score" DOUBLE PRECISION,
    "first_reported_at" TIMESTAMP(3) NOT NULL,
    "last_reported_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',

    CONSTRAINT "project_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_posts_project_id_idx" ON "raw_posts"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_posts_project_id_source_source_post_id_key" ON "raw_posts"("project_id", "source", "source_post_id");

-- CreateIndex
CREATE INDEX "issue_clusters_project_id_idx" ON "issue_clusters"("project_id");

-- CreateIndex
CREATE INDEX "status_history_project_id_idx" ON "status_history"("project_id");

-- CreateIndex
CREATE INDEX "status_history_cluster_id_idx" ON "status_history"("cluster_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_access_user_id_project_id_key" ON "project_access"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "issue_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_clusters" ADD CONSTRAINT "issue_clusters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "issue_clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
