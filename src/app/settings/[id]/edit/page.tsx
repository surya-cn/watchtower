import ConfigForm from "@/components/config/ConfigForm";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectConfigSchema } from "@/lib/schemas";
import styles from "../../Settings.module.css";
import BlurText from "@/components/BlurText/BlurText";

export default async function EditProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { display_name: true, config: true },
  });

  if (!project) notFound();

  // Validate just to ensure type safety matching the form
  const parsedConfig = ProjectConfigSchema.safeParse(project.config);
  
  if (!parsedConfig.success) {
    return <div className={styles.container}>Project configuration is invalid in the database.</div>;
  }

  const initialData = {
    id: params.id,
    display_name: project.display_name,
    config: parsedConfig.data,
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        <BlurText text={`Edit Configuration: ${project.display_name}`} delay={30} animateBy="words" direction="top" />
      </h1>
      <ConfigForm initialData={initialData} isEditMode={true} />
    </div>
  );
}
