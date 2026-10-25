import { useEffect, useState, useCallback } from "react";
import { FileText, Upload, Trash2, Plus, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface DocumentItem {
  id: number;
  studentId: number;
  documentType: string;
  filename: string;
  url: string;
  metadata?: string;
  uploadedAt: string;
}

export default function StudentDocuments() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState("resume");
  const [filename, setFilename] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await fetch("/api/student/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      setDocuments(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim() || !url.trim()) {
      toast.error("Please provide a filename and valid URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/student/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, filename, url }),
      });
      if (!res.ok) throw new Error("Failed to upload document");
      toast.success("Document uploaded successfully");
      setFilename("");
      setUrl("");
      setUploadOpen(false);
      fetchDocuments();
    } catch {
      toast.error("Failed to upload document. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/student/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete document");
      toast.success("Document deleted");
      setDocuments(documents.filter((d) => d.id !== id));
    } catch {
      toast.error("Failed to delete document");
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Credential storage</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Resume & Documents</h2>
          <p className="mt-1 text-sm text-slate-600">Upload and manage your professional resume, certifications, and academic transcripts.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Upload document
        </Button>
      </section>

      {isError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Failed to load documents</p>
              <p className="text-xs mt-0.5">Please check your connection and try refreshing.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-slate-200/80 shadow-sm hover:shadow transition-all bg-white rounded-2xl flex flex-col">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-950 truncate">{doc.filename}</h3>
                      <Badge variant="secondary" className="mt-1 text-[10px] capitalize bg-slate-100 text-slate-700">
                        {doc.documentType}
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                  >
                    View file <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-slate-200 rounded-2xl bg-white shadow-none">
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-900">No documents uploaded yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Upload your resume or certificates to give recruiters verified proof of your qualifications.
            </p>
            <Button onClick={() => setUploadOpen(true)} className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              Upload your first document
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Upload professional document</DialogTitle>
            <DialogDescription>Add a resume, transcript, or certificate link to your portfolio.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium text-slate-700">Document type</Label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="resume">Resume / CV</option>
                <option value="certificate">Certificate</option>
                <option value="transcript">Academic Transcript</option>
                <option value="other">Other Credential</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Document filename / Title</Label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. Software_Engineer_Resume.pdf"
                className="mt-1.5 rounded-xl bg-white border-slate-200"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">File URL (Secure storage link)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://storage.googleapis.com/..."
                className="mt-1.5 rounded-xl bg-white border-slate-200"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ? "Uploading..." : "Upload document"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
