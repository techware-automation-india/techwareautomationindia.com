import { useEffect, useState } from "react";
import { 
  X, Loader2, User, Landmark, Briefcase, FileText, Check, Edit, Save, 
  Mail, Phone, MapPin, Heart, CreditCard, GraduationCap, Calendar,
  Globe, Droplet, Award, Building2
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "../../lib/api.js";

// Read-only field display with icon
const Item = ({ label, value, icon: Icon }) => (
  <div className="group">
    <div className="flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />}
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
    <div className="text-sm font-medium text-foreground break-words pl-5">{value || <span className="text-muted-foreground">—</span>}</div>
  </div>
);

// Editable field
const EditableField = ({ label, value, onChange, type = "text", required = false }) => (
  <div>
    <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  </div>
);

const Section = ({ icon: Icon, title, subtitle, children, accent = "primary" }) => {
  const accentColors = {
    primary: "bg-primary/10 text-primary border-primary/20",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className="rounded-xl border-2 border-border bg-gradient-to-br from-background to-secondary/20 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border/50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${accentColors[accent]}`}>
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

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");

// Enhanced modal that can view/edit onboarding data from Employee module
// Or approve/reject from Requests module
const OnboardingPreview = ({ requestId, employee, onboardingData, loading: parentLoading, onClose, onApprove, onReject, onRefresh, acting }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const isFromRequests = !!requestId;
  const isFromEmployees = !!employee;

  const load = async () => {
    try {
      if (isFromRequests) {
        // Load from requests (existing behavior)
        const data = await apiGet(`/requests/${requestId}/profile`);
        setProfile(data.profile);
      } else if (isFromEmployees) {
        // Data already passed from parent
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
    if (isFromEmployees && onboardingData) {
      setProfile(onboardingData);
      setLoading(false);
    } else if (isFromRequests) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, onboardingData]);

  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.user?.fullName || employee?.fullName
    : "";

  const startEditing = () => {
    setEditedProfile({ ...profile });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedProfile(null);
    setIsEditing(false);
  };

  const saveChanges = async () => {
    console.log("💾 [Frontend] Saving onboarding changes:", editedProfile);
    setSaving(true);
    
    try {
      await apiPut(`/onboarding/employee/${employee.id}`, editedProfile);
      console.log("✅ [Frontend] Onboarding updated successfully");
      toast.success("Onboarding details updated successfully!");
      setProfile(editedProfile);
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("❌ [Frontend] Failed to update onboarding:", err);
      toast.error(err.message || "Failed to update onboarding.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  const displayProfile = isEditing ? editedProfile : profile;
  const showLoading = isFromRequests ? loading : (parentLoading || loading);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-foreground/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border-2 border-border shadow-2xl w-full max-w-5xl my-8">
        {/* Header with gradient */}
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
                  {isFromRequests ? "Review and approve details" : (isEditing ? "Editing employee information" : `Viewing ${fullName}'s complete profile`)}
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

        {/* Body */}
        {showLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Loading employee details...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* Profile Header Card */}
            <div className="rounded-2xl border-2 border-border bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  {displayProfile.profileImage ? (
                    <div className="w-32 h-32 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center border-4 border-primary/20 shadow-xl">
                      <img
                        src={`http://localhost:4000${displayProfile.profileImage}`}
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

                {/* Quick Info */}
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">{fullName}</h3>
                    <p className="text-muted-foreground">{displayProfile.jobTitle || "Employee"}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium">{displayProfile.user?.email || employee?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div className="font-medium">{displayProfile.phone || "—"}</div>
                      </div>
                    </div>
                    {displayProfile.employeeCode && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Award className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Employee Code</div>
                          <div className="font-medium">{displayProfile.employeeCode}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Section icon={User} title="Personal Information" subtitle="Basic identity and demographics" accent="primary">
              {isEditing ? (
                <>
                  <EditableField label="First Name" value={displayProfile.firstName} onChange={(v) => updateField('firstName', v)} required />
                  <EditableField label="Last Name" value={displayProfile.lastName} onChange={(v) => updateField('lastName', v)} required />
                  <EditableField label="Date of Birth" value={displayProfile.dateOfBirth?.slice(0, 10)} onChange={(v) => updateField('dateOfBirth', v)} type="date" />
                  <EditableField label="Gender" value={displayProfile.gender} onChange={(v) => updateField('gender', v)} />
                  <EditableField label="Marital Status" value={displayProfile.maritalStatus} onChange={(v) => updateField('maritalStatus', v)} />
                  <EditableField label="Blood Group" value={displayProfile.bloodGroup} onChange={(v) => updateField('bloodGroup', v)} />
                  <EditableField label="Nationality" value={displayProfile.nationality} onChange={(v) => updateField('nationality', v)} />
                  <EditableField label="Personal Email" value={displayProfile.personalEmail} onChange={(v) => updateField('personalEmail', v)} type="email" />
                </>
              ) : (
                <>
                  <Item label="First Name" value={displayProfile.firstName} icon={User} />
                  <Item label="Last Name" value={displayProfile.lastName} icon={User} />
                  <Item label="Date of Birth" value={fmtDate(displayProfile.dateOfBirth)} icon={Calendar} />
                  <Item label="Gender" value={displayProfile.gender} icon={User} />
                  <Item label="Marital Status" value={displayProfile.maritalStatus} />
                  <Item label="Blood Group" value={displayProfile.bloodGroup} icon={Droplet} />
                  <Item label="Nationality" value={displayProfile.nationality} icon={Globe} />
                  <Item label="Personal Email" value={displayProfile.personalEmail} icon={Mail} />
                </>
              )}
            </Section>

            <Section icon={MapPin} title="Contact & Address" subtitle="Location and phone details" accent="blue">
              {isEditing ? (
                <>
                  <EditableField label="Phone" value={displayProfile.phone} onChange={(v) => updateField('phone', v)} type="tel" required />
                  <EditableField label="Alternate Phone" value={displayProfile.alternatePhone} onChange={(v) => updateField('alternatePhone', v)} type="tel" />
                  <EditableField label="Address Line 1" value={displayProfile.addressLine1} onChange={(v) => updateField('addressLine1', v)} required />
                  <EditableField label="Address Line 2" value={displayProfile.addressLine2} onChange={(v) => updateField('addressLine2', v)} />
                  <EditableField label="City" value={displayProfile.city} onChange={(v) => updateField('city', v)} required />
                  <EditableField label="State" value={displayProfile.state} onChange={(v) => updateField('state', v)} required />
                  <EditableField label="Postal Code" value={displayProfile.postalCode} onChange={(v) => updateField('postalCode', v)} required />
                  <EditableField label="Country" value={displayProfile.country} onChange={(v) => updateField('country', v)} required />
                </>
              ) : (
                <>
                  <Item label="Phone" value={displayProfile.phone} icon={Phone} />
                  <Item label="Alternate Phone" value={displayProfile.alternatePhone} icon={Phone} />
                  <div className="sm:col-span-2">
                    <Item 
                      label="Full Address" 
                      value={[displayProfile.addressLine1, displayProfile.addressLine2, displayProfile.city, displayProfile.state, displayProfile.postalCode, displayProfile.country].filter(Boolean).join(", ")}
                      icon={MapPin}
                    />
                  </div>
                </>
              )}
            </Section>

            <Section icon={Heart} title="Emergency Contact" subtitle="In case of emergency" accent="amber">
              {isEditing ? (
                <>
                  <EditableField label="Contact Name" value={displayProfile.emergencyContactName} onChange={(v) => updateField('emergencyContactName', v)} required />
                  <EditableField label="Relationship" value={displayProfile.emergencyContactRelation} onChange={(v) => updateField('emergencyContactRelation', v)} required />
                  <EditableField label="Emergency Phone" value={displayProfile.emergencyContactPhone} onChange={(v) => updateField('emergencyContactPhone', v)} type="tel" required />
                </>
              ) : (
                <>
                  <Item label="Contact Name" value={displayProfile.emergencyContactName} icon={User} />
                  <Item label="Relationship" value={displayProfile.emergencyContactRelation} icon={Heart} />
                  <Item label="Emergency Phone" value={displayProfile.emergencyContactPhone} icon={Phone} />
                </>
              )}
            </Section>

            <Section icon={CreditCard} title="Banking Information" subtitle="For salary disbursement" accent="emerald">
              {isEditing ? (
                <>
                  <EditableField label="Bank Name" value={displayProfile.bankName} onChange={(v) => updateField('bankName', v)} required />
                  <EditableField label="Account Holder" value={displayProfile.bankAccountName} onChange={(v) => updateField('bankAccountName', v)} required />
                  <EditableField label="Account Number" value={displayProfile.bankAccountNumber} onChange={(v) => updateField('bankAccountNumber', v)} required />
                  <EditableField label="IFSC / Routing" value={displayProfile.bankIfscCode} onChange={(v) => updateField('bankIfscCode', v)} required />
                  <EditableField label="Branch" value={displayProfile.bankBranch} onChange={(v) => updateField('bankBranch', v)} />
                </>
              ) : (
                <>
                  <Item label="Bank Name" value={displayProfile.bankName} icon={Building2} />
                  <Item label="Account Holder" value={displayProfile.bankAccountName} icon={User} />
                  <Item label="Account Number" value={displayProfile.bankAccountNumber} icon={CreditCard} />
                  <Item label="IFSC / Routing Code" value={displayProfile.bankIfscCode} />
                  <Item label="Branch" value={displayProfile.bankBranch} icon={MapPin} />
                </>
              )}
            </Section>

            <Section icon={GraduationCap} title="Professional Details" subtitle="Qualifications and experience" accent="purple">
              {isEditing ? (
                <>
                  <EditableField label="Job Title" value={displayProfile.jobTitle} onChange={(v) => updateField('jobTitle', v)} required />
                  <EditableField label="Highest Qualification" value={displayProfile.highestQualification} onChange={(v) => updateField('highestQualification', v)} required />
                  <EditableField label="University" value={displayProfile.university} onChange={(v) => updateField('university', v)} />
                  <EditableField label="Graduation Year" value={displayProfile.graduationYear} onChange={(v) => updateField('graduationYear', v)} type="number" />
                  <EditableField label="Total Experience (years)" value={displayProfile.totalExperienceYears} onChange={(v) => updateField('totalExperienceYears', v)} type="number" />
                  <EditableField label="Previous Employer" value={displayProfile.previousemployer} onChange={(v) => updateField('previousemployer', v)} />
                  <div className="sm:col-span-2">
                    <EditableField label="Skills" value={displayProfile.skills} onChange={(v) => updateField('skills', v)} />
                  </div>
                </>
              ) : (
                <>
                  <Item label="Job Title" value={displayProfile.jobTitle} icon={Briefcase} />
                  <Item label="Highest Qualification" value={displayProfile.highestQualification} icon={GraduationCap} />
                  <Item label="University" value={displayProfile.university} icon={Building2} />
                  <Item label="Graduation Year" value={displayProfile.graduationYear} icon={Calendar} />
                  <Item 
                    label="Total Experience" 
                    value={
                      displayProfile.totalExperienceYears != null 
                        ? displayProfile.totalExperienceYears === 0 || displayProfile.totalExperienceYears === "0"
                          ? "Fresher (No Experience)"
                          : `${displayProfile.totalExperienceYears} yrs` 
                        : null
                    } 
                    icon={Award} 
                  />
                  <Item label="Previous Employer" value={displayProfile.previousemployer} icon={Building2} />
                  <div className="sm:col-span-2">
                    <Item label="Skills" value={displayProfile.skills} />
                  </div>
                </>
              )}
            </Section>

            <Section icon={FileText} title="Documents & Identification" subtitle="Proof documents and IDs" accent="primary">
              {isEditing ? (
                <>
                  <EditableField label="National ID" value={displayProfile.nationalIdNumber} onChange={(v) => updateField('nationalIdNumber', v)} required />
                  <EditableField label="Tax ID" value={displayProfile.taxIdNumber} onChange={(v) => updateField('taxIdNumber', v)} />
                  <EditableField label="Passport Number" value={displayProfile.passportNumber} onChange={(v) => updateField('passportNumber', v)} />
                  <EditableField label="ID Proof Document" value={displayProfile.idProofDocument} onChange={(v) => updateField('idProofDocument', v)} required />
                  <EditableField label="Address Proof" value={displayProfile.addressProofDocument} onChange={(v) => updateField('addressProofDocument', v)} />
                  <EditableField label="Education Proof" value={displayProfile.educationProofDocument} onChange={(v) => updateField('educationProofDocument', v)} />
                  <EditableField label="Resume / CV" value={displayProfile.resumeDocument} onChange={(v) => updateField('resumeDocument', v)} />
                </>
              ) : (
                <>
                  <Item label="National ID" value={displayProfile.nationalIdNumber} icon={FileText} />
                  <Item label="Tax ID" value={displayProfile.taxIdNumber} icon={FileText} />
                  <Item label="Passport Number" value={displayProfile.passportNumber} icon={FileText} />
                  <Item label="ID Proof Document" value={displayProfile.idProofDocument} icon={FileText} />
                  <Item label="Address Proof" value={displayProfile.addressProofDocument} icon={FileText} />
                  <Item label="Education Proof" value={displayProfile.educationProofDocument} icon={FileText} />
                  <Item label="Resume / CV" value={displayProfile.resumeDocument} icon={FileText} />
                </>
              )}
            </Section>
          </div>
        )}

        {/* Footer actions with gradient */}
        {!showLoading && (
          <div className="relative overflow-hidden border-t-2 border-border/50">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
            <div className="relative flex items-center justify-between gap-3 p-6">
              {isFromRequests ? (
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
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-semibold hover:from-primary/90 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-semibold hover:from-primary/90 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Details
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
