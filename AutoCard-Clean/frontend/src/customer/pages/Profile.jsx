import { useState, useEffect } from "react";
import { UserCircle, Building2, Mail, Phone, MapPin, Edit2, Save, X } from "lucide-react";
import { apiGet, apiPatch } from "../../lib/api.js";
import { toast } from "sonner";
import { getAuthUser } from "../../lib/auth.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    companyName: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/customers/me/profile");
      
      setProfile(data.profile);
      setFormData({
        fullName: data.profile.fullName,
        companyName: data.profile.companyName || "",
        phone: data.profile.phone || "",
        address: data.profile.address || "",
        city: data.profile.city || "",
        country: data.profile.country || "",
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast.error(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData({
      fullName: profile.fullName,
      companyName: profile.companyName || "",
      phone: profile.phone || "",
      address: profile.address || "",
      city: profile.city || "",
      country: profile.country || "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await apiPatch("/customers/me/profile", formData);
      
      setProfile(data.profile);
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account information</p>
          </div>
        </div>
        
        {!editing ? (
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
          >
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {/* Profile Header */}
        <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full cta-gradient flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
              {profile.profileImage ? (
                <img
                  src={`${API_BASE}${profile.profileImage}`}
                  alt={profile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
              )}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{profile.fullName}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Customer since {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={!editing}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="+1 234 567 8900"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Your company name"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Street address"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="City"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Country"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background disabled:bg-secondary/50 disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <h3 className="font-semibold text-lg mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Email Address</div>
              <div className="text-sm text-muted-foreground">{profile.email}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Company</div>
              <div className="text-sm text-muted-foreground">{profile.companyName || "Not specified"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Phone Number</div>
              <div className="text-sm text-muted-foreground">{profile.phone || "Not specified"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Location</div>
              <div className="text-sm text-muted-foreground">
                {profile.city && profile.country ? `${profile.city}, ${profile.country}` : "Not specified"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
