CREATE TYPE "UniformOfDay" AS ENUM ('PT', 'ABU_OCP', 'BLUES');

ALTER TABLE "Event"
ADD COLUMN "uniformOfDay" "UniformOfDay";
