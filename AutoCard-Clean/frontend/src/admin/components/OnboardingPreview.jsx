import { useEffect, useState } from "react";
import {
  X, Loader2, User, Briefcase, FileText, Check,
  Mail, Phone, MapPin, Heart, CreditCard, GraduationCap, Calendar,
  Globe, Droplet, Award, Building2, ExternalLink, Eye, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "../../lib/api.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (v) => {
  if (!v) return null;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const fmtExp = (v) => {
  if (v === null || v === undefined || v === "") return null;
  return Number(v) === 0 ? "Fresher (No Experience)" : `${v} years`;
};

const fmtHours = (value) => {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return "0h 0m";
  const totalMinutes = Math.round(hours * 60);
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
};

// ── sub-components ────────────────────────────────────────────────────────────

const Item = ({ label, value, icon: Icon }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />}
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
    <div className="text-sm font-medium text-foreground break-words pl-5">
      {value || <span className="text-muted-foreground/60">—</span>}
    </div>
  </div>
);

// Renders a clickable open-in-new-tab link for uploaded files,
// falls back to plain text for non-path values, or "—" when empty.
const DocItem = ({ label, value }) => {
  const isUploadPath = value && value.startsWith("/uploads/");
  const isUrl = value && (value.startsWith("http://") || value.startsWith("https://"));
  const href = isUploadPath ? `${API_BASE}${value}` : isUrl ? value : null;
  const filename = isUploadPath ? value.split("/").pop() : value;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className="pl-5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-xs">{filename}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
          </a>
        ) : value ? (
          <span className="text-sm font-medium">{value}</span>
        ) : (
          <span className="text-sm text-muted-foreground/60">—</span>
        )}
      </div>
    </div>
  );
};

const Section = ({ icon: Icon, title, subtitle, children, accent = "primary" }) => {
  const accentColors = {
    primary: "bg-primary/10 text-primary border-primary/20",
    blue:    "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber:   "bg-amber-50 text-amber-600 border-amber-100",
    purple:  "bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <div className="rounded-xl border-2 border-border bg-gradient-to-br from-background to-secondary/20 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0 ${accentColors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-base">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
};

const EditableField = ({ label, value, onChange, type = "text", multiline = false, placeholder = "" }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    {multiline ? (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    ) : (
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    )}
  </label>
);

// ── main component ────────────────────────────────────────────────────────────

const OnboardingPreview = ({
  requestId,
  employee,
  onboardingData,
  loading: parentLoading,
  onClose,
  onApprove,
  onReject,
  acting,
  onRefresh,
}) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [overtimeData, setOvertimeData] = useState(null);
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  const isFromRequests = !!requestId;

  const load = async () => {
    try {
      if (isFromRequests) {
        const data = await apiGet(`/requests/${requestId}/profile`);
        setProfile(data.profile);
      } else if (onboardingData) {
        setProfile(onboardingData);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load profile.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFromRequests && onboardingData) {
      setProfile(onboardingData);
      setLoading(false);
    } else if (isFromRequests) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, onboardingData]);

  useEffect(() => {
    if (profile) {
      setEditForm(profile);
    }
  }, [profile]);

  useEffect(() => {
    const employeeId = profile?.id;
    if (!employeeId || isEditing) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let cancelled = false;

    const loadOvertime = async () => {
      setOvertimeLoading(true);
      try {
        const data = await apiGet(`/attendance/${employeeId}?year=${year}&month=${month}`);
        if (!cancelled) {
          const entries = (data.records || [])
            .map((record) => {
              const workedHours = Number(record.workedHours);
              const overtimeHours = Number.isFinite(workedHours) ? Math.max(0, workedHours - 8) : 0;
              return { ...record, workedHours, overtimeHours };
            })
            .filter((record) => record.overtimeHours > 0);

          setOvertimeData({ year, month, entries });
        }
      } catch (err) {
        if (!cancelled) {
          setOvertimeData({ year, month, entries: [], error: err.message || "Failed to load overtime." });
        }
      } finally {
        if (!cancelled) setOvertimeLoading(false);
      }
    };

    loadOvertime();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, isEditing]);

  const loadLocations = async () => {
    setLocationLoading(true);
    try {
      const data = await apiGet("/locations?limit=100");
      setLocations(data.data ?? []);
    } catch (err) {
      toast.error(err.message || "Failed to load locations.");
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if (isEditing && locations.length === 0) {
      loadLocations();
    }
  }, [isEditing]);

  const handleEditField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentUpload = async (event, fieldName) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const targetUserId = employee?.id || profile?.userId || profile?.user?.id;
    if (!targetUserId) {
      toast.error("Unable to identify the employee for upload.");
      return;
    }

    const allowedExts = /\.(pdf|doc|docx)$/i;
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedExts.test(file.name) || !allowedMimes.includes(file.type)) {
      toast.error("Only PDF, DOC, or DOCX files are allowed.");
      event.target.value = "";
      return;
    }

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(
        `${API_BASE}/api/onboarding/upload-document?field=${fieldName}&userId=${targetUserId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: formData,
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Document upload failed.");
      }

      setEditForm((prev) => ({ ...prev, [fieldName]: data.docPath }));
      toast.success("Document updated successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to upload document.");
    } finally {
      event.target.value = "";
    }
  };

  const isAllowedDocumentFile = (file) => {
    if (!file) return false;

    const allowedExts = /\.(pdf|doc|docx)$/i;
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
      "application/vnd.ms-office",
    ];

    return allowedExts.test(file.name || "") || allowedMimes.includes(file.type);
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const targetUserId = employee?.id || profile?.userId || profile?.user?.id;
    if (!targetUserId) {
      toast.error("Unable to identify the employee for upload.");
      return;
    }

    if (!isAllowedDocumentFile(file)) {
      toast.error("Only PDF, DOC, or DOCX files are allowed.");
      event.target.value = "";
      return;
    }

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(
        `${API_BASE}/api/onboarding/upload-resume?userId=${targetUserId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: formData,
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Resume upload failed.");
      }

      setEditForm((prev) => ({ ...prev, resumeDocument: data.resumePath }));
      toast.success("Resume updated successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to upload resume.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSaveEdit = async () => {
    const targetUserId = employee?.id || profile?.userId || profile?.user?.id;

    if (!targetUserId) {
      toast.error("Unable to identify employee for update.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...editForm,
        dateOfBirth: editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toISOString().slice(0, 10) : null,
        locationId: editForm.locationId || null,
      };

      const data = await apiPut(`/onboarding/employee/${targetUserId}`, payload);
      setProfile(data.profile);
      setIsEditing(false);
      toast.success("Employee onboarding details updated.");
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || "Failed to update employee onboarding details.");
    } finally {
      setSaving(false);
    }
  };

  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.user?.fullName ||
      employee?.fullName
    : "";

  const showLoading = isFromRequests ? loading : parentLoading || loading;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-foreground/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border-2 border-border shadow-2xl w-full max-w-5xl my-8">

        {/* ── Modal Header ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10" />
          <div className="relative flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">
                  {isFromRequests ? "Onboarding Submission" : "Employee Profile"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isFromRequests
                    ? "Review the submitted details before approving"
                    : `Viewing ${fullName}'s complete profile`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {showLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Loading employee details...</p>
          </div>
        ) : isEditing ? (
          <div className="p-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            <div className="rounded-2xl border-2 border-border bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <EditableField label="First Name" value={editForm.firstName} onChange={(v) => handleEditField("firstName", v)} />
                <EditableField label="Last Name" value={editForm.lastName} onChange={(v) => handleEditField("lastName", v)} />
                <EditableField label="Phone" value={editForm.phone} onChange={(v) => handleEditField("phone", v)} />
                <EditableField label="Alternate Phone" value={editForm.alternatePhone} onChange={(v) => handleEditField("alternatePhone", v)} />
                <EditableField label="Personal Email" type="email" value={editForm.personalEmail} onChange={(v) => handleEditField("personalEmail", v)} />
                <EditableField label="Date of Birth" type="date" value={editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toISOString().slice(0, 10) : ""} onChange={(v) => handleEditField("dateOfBirth", v)} />
                <EditableField label="Gender" value={editForm.gender} onChange={(v) => handleEditField("gender", v)} />
                <EditableField label="Marital Status" value={editForm.maritalStatus} onChange={(v) => handleEditField("maritalStatus", v)} />
                <EditableField label="Nationality" value={editForm.nationality} onChange={(v) => handleEditField("nationality", v)} />
                <EditableField label="Blood Group" value={editForm.bloodGroup} onChange={(v) => handleEditField("bloodGroup", v)} />
              </div>
            </div>

            <Section icon={MapPin} title="Contact & Address" subtitle="Update address and contact information" accent="blue">
              <EditableField label="Address Line 1" value={editForm.addressLine1} onChange={(v) => handleEditField("addressLine1", v)} />
              <EditableField label="Address Line 2" value={editForm.addressLine2} onChange={(v) => handleEditField("addressLine2", v)} />
              <EditableField label="City" value={editForm.city} onChange={(v) => handleEditField("city", v)} />
              <EditableField label="State" value={editForm.state} onChange={(v) => handleEditField("state", v)} />
              <EditableField label="Postal Code" value={editForm.postalCode} onChange={(v) => handleEditField("postalCode", v)} />
              <EditableField label="Country" value={editForm.country} onChange={(v) => handleEditField("country", v)} />
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned Location</span>
                  <select
                    value={editForm.locationId ?? ""}
                    onChange={(e) => handleEditField("locationId", e.target.value || null)}
                    disabled={locationLoading}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">None assigned</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}{loc.isDefault ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Section>

            <Section icon={Heart} title="Emergency Contact" subtitle="Update emergency info" accent="amber">
              <EditableField label="Contact Name" value={editForm.emergencyContactName} onChange={(v) => handleEditField("emergencyContactName", v)} />
              <EditableField label="Relationship" value={editForm.emergencyContactRelation} onChange={(v) => handleEditField("emergencyContactRelation", v)} />
              <EditableField label="Emergency Phone" value={editForm.emergencyContactPhone} onChange={(v) => handleEditField("emergencyContactPhone", v)} />
            </Section>

            <Section icon={CreditCard} title="Banking Information" subtitle="Edit salary details" accent="emerald">
              <EditableField label="Bank Name" value={editForm.bankName} onChange={(v) => handleEditField("bankName", v)} />
              <EditableField label="Account Holder" value={editForm.bankAccountName} onChange={(v) => handleEditField("bankAccountName", v)} />
              <EditableField label="Account Number" value={editForm.bankAccountNumber} onChange={(v) => handleEditField("bankAccountNumber", v)} />
              <EditableField label="IFSC / Routing" value={editForm.bankIfscCode} onChange={(v) => handleEditField("bankIfscCode", v)} />
              <EditableField label="Branch" value={editForm.bankBranch} onChange={(v) => handleEditField("bankBranch", v)} />
            </Section>

            <Section icon={GraduationCap} title="Professional Details" subtitle="Update experience and qualifications" accent="purple">
              <EditableField label="Job Title" value={editForm.jobTitle} onChange={(v) => handleEditField("jobTitle", v)} />
              <EditableField label="Highest Qualification" value={editForm.highestQualification} onChange={(v) => handleEditField("highestQualification", v)} />
              <EditableField label="University" value={editForm.university} onChange={(v) => handleEditField("university", v)} />
              <EditableField label="Graduation Year" type="number" value={editForm.graduationYear ?? ""} onChange={(v) => handleEditField("graduationYear", v)} />
              <EditableField label="Total Experience (Years)" type="number" value={editForm.totalExperienceYears ?? ""} onChange={(v) => handleEditField("totalExperienceYears", v)} />
              <EditableField label="Previous Employer" value={editForm.previousemployer} onChange={(v) => handleEditField("previousemployer", v)} />
              <div className="sm:col-span-2">
                <EditableField label="Skills" value={editForm.skills} multiline onChange={(v) => handleEditField("skills", v)} />
              </div>
            </Section>

            <Section icon={FileText} title="Documents & Identification" subtitle="Upload official records and document files" accent="primary">
              <EditableField label="National ID Number" value={editForm.nationalIdNumber} onChange={(v) => handleEditField("nationalIdNumber", v)} />
              <EditableField label="Tax ID" value={editForm.taxIdNumber} onChange={(v) => handleEditField("taxIdNumber", v)} />
              <EditableField label="Passport Number" value={editForm.passportNumber} onChange={(v) => handleEditField("passportNumber", v)} />

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">ID Proof Document</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleDocumentUpload(e, "idProofDocument")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
                {editForm.idProofDocument && (
                  <a href={`${API_BASE}${editForm.idProofDocument}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-primary hover:underline">View current file</a>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Address Proof Document</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleDocumentUpload(e, "addressProofDocument")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
                {editForm.addressProofDocument && (
                  <a href={`${API_BASE}${editForm.addressProofDocument}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-primary hover:underline">View current file</a>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Education Proof Document</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleDocumentUpload(e, "educationProofDocument")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
                {editForm.educationProofDocument && (
                  <a href={`${API_BASE}${editForm.educationProofDocument}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-primary hover:underline">View current file</a>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Resume / CV</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeUpload}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
                {editForm.resumeDocument && (
                  <a href={`${API_BASE}${editForm.resumeDocument}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-primary hover:underline">View current file</a>
                )}
              </label>
            </Section>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">

            {/* Profile header card */}
            <div className="rounded-2xl border-2 border-border bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="shrink-0">
                  {profile.profileImage ? (
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-xl">
                      <img
                        src={`${API_BASE}${profile.profileImage}`}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border-4 border-border shadow-lg">
                      <User className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">{fullName || "—"}</h3>
                    <p className="text-muted-foreground">{profile.jobTitle || "Employee"}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium">{profile.user?.email || employee?.email || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div className="font-medium">{profile.phone || "—"}</div>
                      </div>
                    </div>
                    {profile.employeeCode && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Award className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Employee Code</div>
                          <div className="font-medium">{profile.employeeCode}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <Section icon={User} title="Personal Information" subtitle="Basic identity and demographics" accent="primary">
              <Item label="First Name"     value={profile.firstName} icon={User} />
              <Item label="Last Name"      value={profile.lastName}  icon={User} />
              <Item label="Date of Birth"  value={fmtDate(profile.dateOfBirth)} icon={Calendar} />
              <Item label="Gender"         value={profile.gender}    icon={User} />
              <Item label="Marital Status" value={profile.maritalStatus} />
              <Item label="Blood Group"    value={profile.bloodGroup}  icon={Droplet} />
              <Item label="Nationality"    value={profile.nationality} icon={Globe} />
              <Item label="Personal Email" value={profile.personalEmail} icon={Mail} />
            </Section>

            {/* Contact & Address */}
            <Section icon={MapPin} title="Contact & Address" subtitle="Location and phone details" accent="blue">
              <Item label="Phone"           value={profile.phone}          icon={Phone} />
              <Item label="Alternate Phone" value={profile.alternatePhone} icon={Phone} />
              <div className="sm:col-span-2">
                <Item
                  label="Full Address"
                  value={[
                    profile.addressLine1, profile.addressLine2,
                    profile.city, profile.state,
                    profile.postalCode, profile.country,
                  ].filter(Boolean).join(", ")}
                  icon={MapPin}
                />
              </div>
              <div className="sm:col-span-2">
                <Item
                  label="Assigned Location"
                  value={profile.location?.name || "None assigned"}
                  icon={MapPin}
                />
              </div>
            </Section>

            {/* Emergency Contact */}
            <Section icon={Heart} title="Emergency Contact" subtitle="In case of emergency" accent="amber">
              <Item label="Contact Name"  value={profile.emergencyContactName}     icon={User} />
              <Item label="Relationship"  value={profile.emergencyContactRelation} icon={Heart} />
              <Item label="Emergency Phone" value={profile.emergencyContactPhone}  icon={Phone} />
            </Section>

            {/* Banking */}
            <Section icon={CreditCard} title="Banking Information" subtitle="For salary disbursement" accent="emerald">
              <Item label="Bank Name"       value={profile.bankName}          icon={Building2} />
              <Item label="Account Holder"  value={profile.bankAccountName}   icon={User} />
              <Item label="Account Number"  value={profile.bankAccountNumber} icon={CreditCard} />
              <Item label="IFSC / Routing"  value={profile.bankIfscCode} />
              <Item label="Branch"          value={profile.bankBranch}        icon={MapPin} />
            </Section>

            {/* Professional */}
            <Section icon={GraduationCap} title="Professional Details" subtitle="Qualifications and experience" accent="purple">
              <Item label="Job Title"          value={profile.jobTitle}             icon={Briefcase} />
              <Item label="Qualification"      value={profile.highestQualification} icon={GraduationCap} />
              <Item label="University"         value={profile.university}           icon={Building2} />
              <Item label="Graduation Year"    value={profile.graduationYear}       icon={Calendar} />
              <Item label="Total Experience"   value={fmtExp(profile.totalExperienceYears)} icon={Award} />
              <Item label="Previous Employer"  value={profile.previousemployer}     icon={Building2} />
              {profile.skills && (
                <div className="sm:col-span-2">
                  <Item label="Skills" value={profile.skills} />
                </div>
              )}
            </Section>

            {/* Overtime */}
            <div className="rounded-xl border-2 border-border bg-gradient-to-br from-background to-orange-50/40 p-6">
              <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center border-2 bg-orange-50 text-orange-600 border-orange-100 shrink-0">
                  <Timer className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-base">Overtime</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Current month hours above the standard 8-hour workday
                  </p>
                </div>
                {overtimeData && (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {new Date(overtimeData.year, overtimeData.month - 1).toLocaleString([], { month: "long", year: "numeric" })}
                  </span>
                )}
              </div>

              {overtimeLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading overtime...
                </div>
              ) : overtimeData?.error ? (
                <p className="py-3 text-sm text-rose-600">{overtimeData.error}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-orange-700">Total Overtime</div>
                      <div className="mt-1 text-2xl font-bold text-orange-900">
                        {fmtHours(overtimeData?.entries.reduce((total, record) => total + record.overtimeHours, 0))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-secondary/30 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overtime Days</div>
                      <div className="mt-1 text-2xl font-bold text-foreground">{overtimeData?.entries.length || 0}</div>
                    </div>
                  </div>

                  {overtimeData?.entries.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Worked</th>
                            <th className="px-4 py-3 font-medium text-right">Overtime</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overtimeData.entries.map((record) => (
                            <tr key={record.id || record.date} className="border-t border-border">
                              <td className="px-4 py-3 font-medium">{fmtDate(record.date) || "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{fmtHours(record.workedHours)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-orange-700">{fmtHours(record.overtimeHours)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      No overtime recorded this month.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Documents — all rendered as clickable links */}
            <Section icon={FileText} title="Documents & Identification" subtitle="Click any link to open the document" accent="primary">
              <Item    label="National ID"     value={profile.nationalIdNumber} icon={FileText} />
              <Item    label="Tax ID"          value={profile.taxIdNumber}      icon={FileText} />
              <Item    label="Passport Number" value={profile.passportNumber}   icon={FileText} />
              <DocItem label="ID Proof"        value={profile.idProofDocument} />
              <DocItem label="Address Proof"   value={profile.addressProofDocument} />
              <DocItem label="Education Proof" value={profile.educationProofDocument} />
              <div className="sm:col-span-2">
                <DocItem label="Resume / CV"   value={profile.resumeDocument} />
              </div>
            </Section>

          </div>
        )}

        {/* ── Footer ── */}
        {!showLoading && (
          <div className="relative overflow-hidden border-t-2 border-border/50">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
            <div className="relative flex items-center justify-between gap-3 p-6">
              {isFromRequests ? (
                /* Requests view: Approve / Reject */
                <>
                  <button
                    onClick={onReject}
                    disabled={acting}
                    className="px-5 py-2.5 rounded-lg border-2 border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 hover:border-rose-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Reject Submission
                  </button>
                  <button
                    onClick={onApprove}
                    disabled={acting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold hover:from-emerald-700 hover:to-green-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {acting ? "Processing..." : "Approve & Activate"}
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-white text-sm font-semibold hover:opacity-95 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={onClose}
                    className="ml-auto px-6 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-5 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={onClose}
                    className="ml-auto px-6 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OnboardingPreview;
