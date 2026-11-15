import { useEffect, useState, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import {
  FileText,
  Upload,
  Trash2,
  Plus,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  HardDrive,
} from "lucide-react";
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
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  hasExtractedText?: boolean;
  url: string;
  metadata?: string;
  uploadedAt: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentDocuments() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState("resume");
  const [filename, setFilename] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    // Validate file size limit (15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size limit of 15MB.");
      return;
    }
    setSelectedFile(file);
    if (!filename.trim()) {
      setFilename(file.name);
    }
    toast.success(`Selected file: ${file.name} (${formatBytes(file.size)})`);
  };

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await customFetch<DocumentItem[]>("/api/student/documents");
      if (data) setDocuments(data);
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
    if (!selectedFile) {
      toast.error("Please select a file to upload from your device.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);
      formData.append("filename", filename.trim() || selectedFile.name);

      await customFetch("/api/student/documents", {
        method: "POST",
        body: formData,
      });

      toast.success("Document uploaded and saved to secure storage.");
      setSelectedFile(null);
      setFilename("");
      setUploadOpen(false);
      fetchDocuments();
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to upload document. Please try again.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await customFetch(`/api/student/documents/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
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
          <p className="mt-1 text-sm text-slate-600">
            Upload and manage your professional resume, certifications, and academic transcripts with persistent cloud storage and AI text extraction.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedFile(null);
            setFilename("");
            setUploadOpen(true);
          }}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 cursor-pointer"
        >
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-slate-200/80 shadow-sm hover:shadow-md transition-all bg-white rounded-2xl flex flex-col">
              <CardContent className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-950 truncate" title={doc.filename}>
                          {doc.filename}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] capitalize bg-slate-100 text-slate-700">
                            {doc.documentType}
                          </Badge>
                          {doc.fileSize ? (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatBytes(doc.fileSize)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {doc.documentType === "resume" && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{doc.hasExtractedText ? "Text Parsed for AI" : "Stored in GridFS"}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    View / Download <ExternalLink className="h-3.5 w-3.5" />
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
            <Button
              onClick={() => {
                setSelectedFile(null);
                setFilename("");
                setUploadOpen(true);
              }}
              className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
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
            <DialogDescription>
              Select your PDF, DOCX, or text document to save persistently to your account.
            </DialogDescription>
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

            {/* Local File Drag & Drop / Explorer */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Upload file</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg";
                  input.onchange = (ev: any) => {
                    if (ev.target.files && ev.target.files[0]) {
                      handleFileSelect(ev.target.files[0]);
                    }
                  };
                  input.click();
                }}
                className={`mt-1.5 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-indigo-600 bg-indigo-50/50"
                    : selectedFile
                    ? "border-emerald-500 bg-emerald-50/30"
                    : "border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20"
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileCheck className="mx-auto h-8 w-8 text-emerald-600 mb-1" />
                    <p className="text-sm font-semibold text-slate-900 truncate max-w-[280px] mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                    <p className="text-[11px] text-indigo-600 font-medium pt-1">Click to replace file</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-indigo-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-800">Drag & drop your file here</p>
                    <p className="text-xs text-slate-500 mt-1">Supports PDF, DOCX, TXT (Max 15MB)</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      Browse device files
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Display filename / Title</Label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. Software_Engineer_Resume.pdf"
                className="mt-1.5 rounded-xl bg-white border-slate-200"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {isSubmitting ? "Uploading..." : "Save document"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
