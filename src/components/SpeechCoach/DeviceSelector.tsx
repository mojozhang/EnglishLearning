"use client";

import { useEffect, useState } from "react";

interface DeviceSelectorProps {
  onDeviceSelect: (deviceId: string) => void;
}

export default function DeviceSelector({
  onDeviceSelect,
}: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Must request permission first to get labels
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);

        if (audioInputs.length > 0) {
          // Try to restore from localStorage
          const savedId = localStorage.getItem("selectedMicId");
          let targetDevice = audioInputs[0];

          if (savedId) {
            const found = audioInputs.find((d) => d.deviceId === savedId);
            if (found) targetDevice = found;
          } else {
            // finding default if no saved
            const defaultDevice = audioInputs.find(
              (d) => d.deviceId === "default",
            );
            if (defaultDevice) targetDevice = defaultDevice;
          }

          setSelectedId(targetDevice.deviceId);
          onDeviceSelect(targetDevice.deviceId);
        }
      } catch (err) {
        console.error("Error listing devices:", err);
      }
    };

    getDevices();

    // Listen for device changes (plug/unplug)
    navigator.mediaDevices.ondevicechange = () => {
      getDevices();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    onDeviceSelect(id);
    localStorage.setItem("selectedMicId", id);
  };

  if (devices.length === 0) return null;

  return (
    <div style={{ margin: "1rem 0" }}>
      <label style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}>
        Select Microphone:{" "}
      </label>
      <select
        value={selectedId}
        onChange={handleChange}
        style={{
          padding: "0.5rem",
          borderRadius: "4px",
          border: "1px solid var(--border)",
          background: "var(--background)",
          maxWidth: "300px",
        }}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
          </option>
        ))}
      </select>
    </div>
  );
}
