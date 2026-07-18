import ConfigForm from "@/components/config/ConfigForm";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectConfigSchema } from "@/lib/schemas";

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
    return <div className="text-red-500 p-8">Project configuration is invalid in the database.</div>;
  }

  const initialData = {
    id: params.id,
    display_name: project.display_name,
    config: parsedConfig.data,
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-extrabold text-white mb-6">Edit Configuration: {project.display_name}</h1>
      <ConfigForm initialData={initialData} isEditMode={true} />
    </div>
  );
}
