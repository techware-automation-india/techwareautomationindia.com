import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";

export default function AddLocationModal({
  open,
  onClose,
  onSave,
  initialData = null,
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: "",
    status: "Active",
  });

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        radius: "",
        status: "Active",
      });
    }
  }, [initialData]);

  if (!open) return null;

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = () => {
    if (!form.name || !form.address) {
      alert("Please fill all required fields.");
      return;
    }

    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl">
        {/* Header */}

        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <MapPin className="text-emerald-600" />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                {initialData ? "Edit Location" : "Add Location"}
              </h2>

              <p className="text-sm text-gray-500">
                Enter office location details.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X />
          </button>
        </div>

        {/* Body */}

        <div className="p-6 space-y-5">
          <div>
            <label className="block mb-2 font-medium">Location Name</label>

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Noida Office"
              className="w-full border rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Address</label>

            <textarea
              rows={3}
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Sector 62, Noida"
              className="w-full border rounded-xl px-4 py-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-medium">
                Latitude{" "}
                <span className="text-gray-400 text-sm">(Optional)</span>
              </label>

              <input
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                placeholder="28.6139"
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">
                Longitude{" "}
                <span className="text-gray-400 text-sm">(Optional)</span>
              </label>

              <input
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                placeholder="77.2090"
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-medium">
                Radius (Meters){" "}
                <span className="text-gray-400 text-sm">(Optional)</span>
              </label>

              <input
                type="number"
                name="radius"
                value={form.radius}
                onChange={handleChange}
                placeholder="100"
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Status</label>

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}

        <div className="border-t p-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl border">
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-6 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {initialData ? "Update Location" : "Save Location"}
          </button>
        </div>
      </div>
    </div>
  );
}
