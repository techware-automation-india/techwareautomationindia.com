import { useEffect, useState, useRef } from "react";
import { 
  ClipboardList, Loader2, Send, CheckCircle2, Clock, User, Landmark, 
  Briefcase, FileText, MapPin, Heart, Camera, ChevronRight, ChevronLeft,
  CheckCircle, UploadCloud, X, FileCheck2
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { updateAuthUser } from "../../lib/auth.js";

const emptyForm = {
  // Personal
  firstName: "", lastName: "", phone: "", alternatePhone: "", personalEmail: "",
  dateOfBirth: "", gender: "", maritalStatus: "", nationality: "", bloodGroup: "",
  addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "",
  emergencyContactName: "", emergencyContactRelation: "", emergencyContactPhone: "",
  // Banking
  bankName: "", bankAccountName: "", bankAccountNumber: "", bankIfscCode: "", bankBranch: "",
  // Professional
  jobTitle: "", highestQualification: "", university: "", graduationYear: "",
  totalExperienceYears: "", previousEmployer: "", skills: "",
  // Proofs
  nationalIdNumber: "", taxIdNumber: "", passportNumber: "",
  idProofDocument: "", addressProofDocument: "", educationProofDocument: "", resumeDocument: "",
  // Profile Image
  profileImage: "",
};

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const currentYear = new Date().getFullYear();
// Latest DOB allowing 18 years of age.
const maxDob = new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

// Labeled field wrapper. `required` adds a red asterisk.
const Field = ({ label, required, children, full }) => (
  <div className={full ? "sm:col-span-2" : ""}>
    <label className="text-sm font-medium mb-1.5 block">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
  </div>
);

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Resume upload state
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false); // true once server confirms
  const resumeInputRef = useRef(null);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const steps = [
    { id: 0, name: "Profile Photo", icon: Camera, desc: "Upload your profile picture" },
    { id: 1, name: "Personal Info", icon: User, desc: "Basic identity details" },
    { id: 2, name: "Contact", icon: MapPin, desc: "Address and contact" },
    { id: 3, name: "Emergency", icon: Heart, desc: "Emergency contact" },
    { id: 4, name: "Banking", icon: Landmark, desc: "Bank account details" },
    { id: 5, name: "Professional", icon: Briefcase, desc: "Work experience" },
    { id: 6, name: "Documents", icon: FileText, desc: "Proof documents" },
  ];

  const loadProfile = async () => {
    try {
      const data = await apiGet("/onboarding/me");
      const p = data.profile;
      setStatus(p.onboardingStatus);
      // Hydrate any previously-entered values.
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(emptyForm).map((k) => {
            if (k === "dateOfBirth") return [k, p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : ""];
            if (k === "previousEmployer") return [k, p.previousemployer ?? ""];
            const val = p[k];
            return [k, val === null || val === undefined ? "" : String(val)];
          })
        ),
      }));
      // If a resume was previously uploaded, reflect it in the UI
      if (p.resumeDocument) {
        setResumeUploaded(true);
        setResumeFile({ name: p.resumeDocument.split("/").pop(), size: 0 });
      }
    } catch (err) {
      toast.error(err.message || "Failed to load onboarding.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadProfile();
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    if (!validateStep(currentStep)) {
      return;
    }
    
    setSubmitting(true);
    try {
      // Upload image first if selected
      let profileImagePath = form.profileImage;
      if (imageFile && !profileImagePath) {
        try {
          const formData = new FormData();
          formData.append("profileImage", imageFile);
          
          const uploadResponse = await fetch("http://localhost:4000/api/onboarding/upload-image", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
            },
            body: formData,
          });
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            profileImagePath = uploadData.imagePath;
          }
        } catch (uploadErr) {
          console.warn("Image upload failed, continuing without image:", uploadErr);
        }
      }

      const data = await apiPost("/onboarding/submit", {
        ...form,
        profileImage: profileImagePath,
      });
      setStatus(data.profile.onboardingStatus);
      updateAuthUser({ onboardingStatus: data.profile.onboardingStatus });
      toast.success("Onboarding submitted. Awaiting admin approval.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err.message || "Failed to submit onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleResumeChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExts = /\.(pdf|doc|docx)$/i;
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedExts.test(file.name) || !allowedMimes.includes(file.type)) {
      toast.error("Only PDF, DOC, or DOCX files are allowed.");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume file must be 10 MB or smaller.");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    setResumeFile(file);
    setResumeUploaded(false);
    setResumeUploading(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("http://localhost:4000/api/onboarding/upload-resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Resume upload failed.");
        setResumeFile(null);
        if (resumeInputRef.current) resumeInputRef.current.value = "";
        return;
      }

      setForm((p) => ({ ...p, resumeDocument: data.resumePath }));
      setResumeUploaded(true);
      toast.success("Resume uploaded successfully!");
    } catch (err) {
      toast.error("Resume upload failed. Please try again.");
      setResumeFile(null);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    } finally {
      setResumeUploading(false);
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    setResumeUploaded(false);
    setForm((p) => ({ ...p, resumeDocument: "" }));
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateStep = (step) => {
    switch (step) {
      case 0: // Profile photo - optional
        return true;
      case 1: // Personal Info
        if (!form.firstName || !form.lastName || !form.phone || !form.dateOfBirth || !form.gender || !form.nationality) {
          toast.error("Please fill all required personal fields");
          return false;
        }
        return true;
      case 2: // Contact
        if (!form.addressLine1 || !form.city || !form.state || !form.postalCode || !form.country) {
          toast.error("Please fill all required address fields");
          return false;
        }
        return true;
      case 3: // Emergency
        if (!form.emergencyContactName || !form.emergencyContactRelation || !form.emergencyContactPhone) {
          toast.error("Please fill all emergency contact fields");
          return false;
        }
        return true;
      case 4: // Banking
        if (!form.bankName || !form.bankAccountName || !form.bankAccountNumber || !form.bankIfscCode) {
          toast.error("Please fill all required banking fields");
          return false;
        }
        return true;
      case 5: // Professional
        if (!form.jobTitle || !form.highestQualification) {
          toast.error("Please fill all required professional fields");
          return false;
        }
        return true;
      case 6: // Documents
        if (!form.nationalIdNumber || !form.idProofDocument) {
          toast.error("Please fill all required document fields");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const header = (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <ClipboardList className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">Employee Onboarding</h1>
        <p className="text-sm text-muted-foreground">Complete your profile to get started</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {header}
        <div className="p-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      </div>
    );
  }

  if (status === "SUBMITTED") {
    return (
      <div className="space-y-8">
        {header}
        <div className="rounded-2xl border border-border bg-background p-12 flex flex-col items-center text-center card-shadow">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Clock className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">Awaiting Approval</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Your onboarding form has been submitted and is pending admin approval. Once approved, you'll get access to attendance and leave modules.
          </p>
        </div>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="space-y-8">
        {header}
        <div className="rounded-2xl border border-border bg-background p-12 flex flex-col items-center text-center card-shadow">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">Onboarding Approved</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Your onboarding is complete and approved. You now have full access to all employee modules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {header}

      {status === "REJECTED" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Your previous submission was rejected. Please review your details and resubmit.
        </div>
      )}

      {/* Progress Steps */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    idx < currentStep
                      ? "bg-emerald-100 text-emerald-700"
                      : idx === currentStep
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <div className="text-center mt-2">
                  <p className={`text-xs font-medium ${idx === currentStep ? "text-primary" : "text-muted-foreground"}`}>
                    {step.name}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 -mt-8 ${
                    idx < currentStep ? "bg-emerald-300" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <form onSubmit={handleSubmit} className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            {(() => {
              const StepIcon = steps[currentStep].icon;
              return <StepIcon className="h-5 w-5 text-primary" />;
            })()}
            {steps[currentStep].name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{steps[currentStep].desc}</p>
        </div>

        {/* Step 0: Profile Photo */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 py-8">
              {/* Left side: Instructions */}
              <div className="flex-1 space-y-4">
                <h3 className="text-lg font-semibold">Upload Your Profile Picture</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A professional photo helps colleagues recognize you and makes your profile more personal. 
                  Please choose a clear, recent photo where your face is visible.
                </p>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Use a recent photo with good lighting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Face should be clearly visible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Accepted formats: JPG, PNG, GIF, WEBP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Maximum file size: 5MB</span>
                  </li>
                </ul>
                <div className="pt-4">
                  <label className="px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 cursor-pointer transition-opacity inline-block">
                    Choose Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-3 italic">This step is optional - you can skip and add later</p>
                </div>
              </div>

              {/* Right side: Image preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-48 h-48 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center border-4 border-border shadow-lg">
                  {imagePreview || form.profileImage ? (
                    <img
                      src={imagePreview || `http://localhost:4000${form.profileImage}`}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-24 h-24 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">Preview</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Personal Info */}
        {currentStep === 1 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="First Name" required>
              <input className={inputClass} value={form.firstName} onChange={set("firstName")} maxLength={60} placeholder="Jane" required />
            </Field>
            <Field label="Last Name" required>
              <input className={inputClass} value={form.lastName} onChange={set("lastName")} maxLength={60} placeholder="Doe" required />
            </Field>
            <Field label="Phone" required>
              <input type="tel" className={inputClass} value={form.phone} onChange={set("phone")} pattern="[+]?[\d\s()\-]{7,20}" title="7-20 digits, may include + ( ) -" placeholder="+1 555 123 4567" required />
            </Field>
            <Field label="Alternate Phone">
              <input type="tel" className={inputClass} value={form.alternatePhone} onChange={set("alternatePhone")} pattern="[+]?[\d\s()\-]{7,20}" title="7-20 digits, may include + ( ) -" placeholder="Optional" />
            </Field>
            <Field label="Personal Email">
              <input type="email" className={inputClass} value={form.personalEmail} onChange={set("personalEmail")} placeholder="jane@example.com" />
            </Field>
            <Field label="Date of Birth" required>
              <input type="date" className={inputClass} value={form.dateOfBirth} onChange={set("dateOfBirth")} max={maxDob} min="1925-01-01" required />
            </Field>
            <Field label="Gender" required>
              <select className={inputClass} value={form.gender} onChange={set("gender")} required>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Marital Status">
              <select className={inputClass} value={form.maritalStatus} onChange={set("maritalStatus")}>
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Nationality" required>
              <input className={inputClass} value={form.nationality} onChange={set("nationality")} maxLength={60} placeholder="e.g. American" required />
            </Field>
            <Field label="Blood Group">
              <select className={inputClass} value={form.bloodGroup} onChange={set("bloodGroup")}>
                <option value="">Select...</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Step 2: Contact & Address */}
        {currentStep === 2 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Address Line 1" required full>
              <input className={inputClass} value={form.addressLine1} onChange={set("addressLine1")} maxLength={200} placeholder="Street address" required />
            </Field>
            <Field label="Address Line 2" full>
              <input className={inputClass} value={form.addressLine2} onChange={set("addressLine2")} maxLength={200} placeholder="Apartment, suite, etc. (optional)" />
            </Field>
            <Field label="City" required>
              <input className={inputClass} value={form.city} onChange={set("city")} maxLength={80} placeholder="City" required />
            </Field>
            <Field label="State / Province" required>
              <input className={inputClass} value={form.state} onChange={set("state")} maxLength={80} placeholder="State" required />
            </Field>
            <Field label="Postal Code" required>
              <input className={inputClass} value={form.postalCode} onChange={set("postalCode")} pattern="[A-Za-z0-9\s\-]{3,12}" title="3-12 letters, digits, spaces or hyphens" placeholder="ZIP / Postal code" required />
            </Field>
            <Field label="Country" required>
              <input className={inputClass} value={form.country} onChange={set("country")} maxLength={80} placeholder="Country" required />
            </Field>
          </div>
        )}

        {/* Step 3: Emergency Contact */}
        {currentStep === 3 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Contact Name" required>
              <input className={inputClass} value={form.emergencyContactName} onChange={set("emergencyContactName")} maxLength={120} placeholder="Full name" required />
            </Field>
            <Field label="Relationship" required>
              <input className={inputClass} value={form.emergencyContactRelation} onChange={set("emergencyContactRelation")} maxLength={60} placeholder="e.g. Spouse, Parent" required />
            </Field>
            <Field label="Contact Phone" required full>
              <input type="tel" className={inputClass} value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} pattern="[+]?[\d\s()\-]{7,20}" title="7-20 digits, may include + ( ) -" placeholder="+1 555 987 6543" required />
            </Field>
          </div>
        )}

        {/* Step 4: Banking */}
        {currentStep === 4 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Bank Name" required>
              <input className={inputClass} value={form.bankName} onChange={set("bankName")} maxLength={120} placeholder="Bank name" required />
            </Field>
            <Field label="Account Holder Name" required>
              <input className={inputClass} value={form.bankAccountName} onChange={set("bankAccountName")} maxLength={120} placeholder="As per bank records" required />
            </Field>
            <Field label="Account Number" required>
              <input className={inputClass} value={form.bankAccountNumber} onChange={set("bankAccountNumber")} inputMode="numeric" pattern="\d{6,20}" title="6-20 digits" placeholder="Account number" required />
            </Field>
            <Field label="IFSC / Routing Code" required>
              <input className={inputClass} value={form.bankIfscCode} onChange={(e) => setForm((p) => ({ ...p, bankIfscCode: e.target.value.toUpperCase() }))} pattern="[A-Za-z0-9\-]{4,20}" title="4-20 letters, digits or hyphens" placeholder="e.g. ABCD0123456" required />
            </Field>
            <Field label="Branch" full>
              <input className={inputClass} value={form.bankBranch} onChange={set("bankBranch")} maxLength={120} placeholder="Branch name (optional)" />
            </Field>
          </div>
        )}

        {/* Step 5: Professional */}
        {currentStep === 5 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Job Title" required>
              <input className={inputClass} value={form.jobTitle} onChange={set("jobTitle")} maxLength={120} placeholder="e.g. Automation Engineer" required />
            </Field>
            <Field label="Highest Qualification" required>
              <input className={inputClass} value={form.highestQualification} onChange={set("highestQualification")} maxLength={120} placeholder="e.g. B.Sc Computer Science" required />
            </Field>
            <Field label="University / Institution">
              <input className={inputClass} value={form.university} onChange={set("university")} maxLength={200} placeholder="Optional" />
            </Field>
            <Field label="Graduation Year">
              <input type="number" className={inputClass} value={form.graduationYear} onChange={set("graduationYear")} min={1950} max={currentYear} placeholder={`1950 - ${currentYear}`} />
            </Field>
            <Field label="Total Experience">
              <select 
                className={inputClass} 
                value={form.totalExperienceYears} 
                onChange={set("totalExperienceYears")}
              >
                <option value="">Select experience...</option>
                <option value="0">Fresher (No Experience)</option>
                <option value="0.5">6 months</option>
                <option value="1">1 year</option>
                <option value="1.5">1.5 years</option>
                <option value="2">2 years</option>
                <option value="2.5">2.5 years</option>
                <option value="3">3 years</option>
                <option value="3.5">3.5 years</option>
                <option value="4">4 years</option>
                <option value="4.5">4.5 years</option>
                <option value="5">5 years</option>
                <option value="6">6 years</option>
                <option value="7">7 years</option>
                <option value="8">8 years</option>
                <option value="9">9 years</option>
                <option value="10">10 years</option>
                <option value="15">15 years</option>
                <option value="20">20+ years</option>
              </select>
            </Field>
            <Field label="Previous Employer">
              <input 
                className={inputClass} 
                value={form.previousEmployer} 
                onChange={set("previousEmployer")} 
                maxLength={200} 
                placeholder={form.totalExperienceYears === "0" ? "N/A (Fresher)" : "Optional"} 
                disabled={form.totalExperienceYears === "0"}
              />
            </Field>
            <Field label="Skills" full>
              <textarea className={inputClass + " resize-none"} rows={3} value={form.skills} onChange={set("skills")} maxLength={500} placeholder="Comma-separated skills (optional)" />
            </Field>
          </div>
        )}

        {/* Step 6: Documents */}
        {currentStep === 6 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="National ID Number" required>
              <input className={inputClass} value={form.nationalIdNumber} onChange={set("nationalIdNumber")} minLength={4} maxLength={40} placeholder="Government ID number" required />
            </Field>
            <Field label="Tax ID Number">
              <input className={inputClass} value={form.taxIdNumber} onChange={set("taxIdNumber")} maxLength={40} placeholder="Optional" />
            </Field>
            <Field label="Passport Number">
              <input className={inputClass} value={form.passportNumber} onChange={set("passportNumber")} maxLength={40} placeholder="Optional" />
            </Field>
            <div className="hidden sm:block" />
            <Field label="ID Proof Document" required full>
              <input className={inputClass} value={form.idProofDocument} onChange={set("idProofDocument")} maxLength={300} placeholder="Document name or link (e.g. passport_scan.pdf)" required />
            </Field>
            <Field label="Address Proof Document">
              <input className={inputClass} value={form.addressProofDocument} onChange={set("addressProofDocument")} maxLength={300} placeholder="Optional" />
            </Field>
            <Field label="Education Proof Document">
              <input className={inputClass} value={form.educationProofDocument} onChange={set("educationProofDocument")} maxLength={300} placeholder="Optional" />
            </Field>
            <Field label="Resume / CV" full>
              {/* ── Resume upload widget ── */}
              <div className="space-y-3">
                {/* Drop zone / picker */}
                {!resumeUploaded ? (
                  <label
                    className={`flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors
                      ${resumeUploading
                        ? "border-primary/40 bg-primary/5 cursor-not-allowed"
                        : "border-border hover:border-primary/50 hover:bg-primary/5"
                      }`}
                  >
                    {resumeUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">Uploading…</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            Click to upload your Resume / CV
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, DOC, DOCX &nbsp;·&nbsp; Max 10 MB
                          </p>
                        </div>
                      </>
                    )}
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleResumeChange}
                      disabled={resumeUploading}
                      className="hidden"
                    />
                  </label>
                ) : (
                  /* Uploaded file card */
                  <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileCheck2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-900 truncate">
                        {resumeFile?.name || form.resumeDocument.split("/").pop()}
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Uploaded successfully
                        {resumeFile?.size > 0 && (
                          <span className="text-emerald-600 ml-1">· {formatBytes(resumeFile.size)}</span>
                        )}
                      </p>
                    </div>
                    {/* Allow replacing the file */}
                    <button
                      type="button"
                      onClick={handleRemoveResume}
                      className="p-1.5 rounded-lg hover:bg-emerald-200 text-emerald-700 transition-colors"
                      title="Remove and re-upload"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* View link if already saved on server */}
                {form.resumeDocument && (
                  <a
                    href={`http://localhost:4000${form.resumeDocument}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View uploaded resume
                  </a>
                )}
              </div>
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Fields marked <span className="text-destructive">*</span> are required. Resume upload is optional.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="cta-gradient text-white font-semibold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="cta-gradient text-white font-semibold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit for Approval"}
            </button>
          )}
        </div>
      </form>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>
    </div>
  );
};

export default Onboarding;
