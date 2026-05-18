import { FileText, ExternalLink, Download } from 'lucide-react';

const ICONS = {
  pdf:  FileText,
  link: ExternalLink,
};

export default function ResourceList({ resources = [] }) {
  if (!resources.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Resources</p>
      <ul className="space-y-1">
        {resources.map(r => {
          const isPdf = /pdf/i.test(r.mime_type || '') || /\.pdf$/i.test(r.file_url);
          const Icon = isPdf ? ICONS.pdf : ICONS.link;
          return (
            <li key={r.id}>
              <a
                href={r.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-accent/40 hover:bg-orange-50/30 transition-colors text-sm text-gray-800"
              >
                <Icon size={14} className="text-gray-400 shrink-0" />
                <span className="truncate flex-1">{r.label}</span>
                <Download size={12} className="text-gray-300" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
