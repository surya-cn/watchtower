import ConfigForm from "@/components/config/ConfigForm";

export default function NewProjectPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-extrabold text-white mb-6">Create New Project</h1>
      <ConfigForm />
    </div>
  );
}
