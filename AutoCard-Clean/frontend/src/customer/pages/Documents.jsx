import { useState, useEffect } from "react";
import { FileArchive, Eye, FileText, Loader2, File } from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4001";

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/customers/me/documents");
      setDocuments(data.documents || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
      toast.error(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const getFileExtension = (fileName) => {
    return fileName.split('.').pop().toUpperCase();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileCategory = (fileType) => {
    if (!fileType) return "Other";
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("word") || fileType.includes("document")) return "Document";
    if (fileType.includes("image")) return "Image";
    if (fileType.includes("zip") || fileType.includes("compressed")) return "Archive";
    if (fileType.includes("spreadsheet") || fileType.includes("excel")) return "Spreadsheet";
    return "Other";
  };

  const handleViewDocument = (doc) => {
    // Open document in new tab for viewing
    const url = `${API_BASE}${doc.fileUrl}`;
    window.open(url, '_blank');
  };

  const categories = ["ALL", ...new Set(documents.map(doc => getFileCategory(doc.fileType)))];
  
  const filteredDocuments = filter === "ALL" 
    ? documents 
    : documents.filter(doc => getFileCategory(doc.fileType) === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileArchive className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">Access your project documents and files</p>
        </div>
      </div>

      {/* Info Notice */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 text-sm mb-1">View Only Access</h3>
           
          </div>
        </div>
      </div>

      {/* Filter */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Filter by type:</span>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === category
                  ? "bg-primary text-white"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {category}
            </button>
          ))}
          <span className="text-sm text-muted-foreground ml-2">
            ({filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'})
          </span>
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl bg-background border border-border card-shadow p-12 text-center">
          <FileArchive className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No Documents Found</h3>
          <p className="text-sm text-muted-foreground">
            {documents.length === 0 
              ? "No documents have been shared with you yet."
              : "No documents match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium text-sm">{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground">{getFileExtension(doc.fileName)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{doc.project.name}</div>
                      <div className="text-xs text-muted-foreground">{doc.project.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {getFileCategory(doc.fileType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleViewDocument(doc)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
                        title="View Document"
                      >
                        <Eye className="h-4 w-4" />
                        View Only
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
