import { X, Clock3 } from "lucide-react";
import { useState, useEffect } from "react";

export default function AddShiftModal({
  open,
  onClose,
  onSave,
  initialData = null,
}) {
  const [form, setForm] = useState({
    name: "",
    startTime: "",
    endTime: "",
    graceTime: "",
    status: "Active",
  });

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({
        name: "",
        startTime: "",
        endTime: "",
        graceTime: "",
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
    if (
      !form.name ||
      !form.startTime ||
      !form.endTime ||
      !form.graceTime
    ) {
      alert("Please fill all required fields.");
      return;
    }

    onSave(form);

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl">

        {/* Header */}

        <div className="flex items-center justify-between p-6 border-b">

          <div className="flex items-center gap-3">

            <div className="bg-blue-100 p-3 rounded-xl">

              <Clock3 className="text-blue-600" />

            </div>

            <div>

              <h2 className="text-xl font-bold">

                {initialData ? "Edit Shift" : "Create Shift"}

              </h2>

              <p className="text-gray-500 text-sm">
                Enter shift details below.
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

            <label className="block mb-2 text-sm font-medium">
              Shift Name
            </label>

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Morning Shift"
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <div>

              <label className="block mb-2 text-sm font-medium">
                Start Time
              </label>

              <input
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                className="w-full border rounded-xl px-4 py-3"
              />

            </div>

            <div>

              <label className="block mb-2 text-sm font-medium">
                End Time
              </label>

              <input
                type="time"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                className="w-full border rounded-xl px-4 py-3"
              />

            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <div>

              <label className="block mb-2 text-sm font-medium">
                Grace Time (Minutes)
              </label>

              <input
                type="number"
                name="graceTime"
                value={form.graceTime}
                onChange={handleChange}
                placeholder="15"
                className="w-full border rounded-xl px-4 py-3"
              />

            </div>

            <div>

              <label className="block mb-2 text-sm font-medium">
                Status
              </label>

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

          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            {initialData ? "Update Shift" : "Create Shift"}
          </button>

        </div>

      </div>

    </div>
  );
}