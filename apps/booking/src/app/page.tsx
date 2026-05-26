import { projects, siteConfig } from '@/config/projects';
import { ProjectCard } from '@/components/ProjectCard';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-gray-900">{siteConfig.brandName}</span>
          </div>
          <span className="text-sm text-gray-400">{siteConfig.tagline}</span>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight">
            Let&apos;s find a time to connect.
          </h1>
          <p className="text-gray-500 text-base">
            Choose the session that fits what you&apos;re looking for.
          </p>
        </div>

        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400 text-center">
          All times shown in Philippines Standard Time (PST, UTC+8)
        </p>
      </main>
    </div>
  );
}
