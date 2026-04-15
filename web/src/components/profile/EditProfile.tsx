import { useState } from "react";
import { Input, Textarea, Button } from "../form/Form";
import * as limits from "../../lib/limits";

interface EditProfileProps {
  initialName: string;
  initialPronouns: string;
  initialBio: string;
  onSave: (name?: string, pronouns?: string, bio?: string) => Promise<void>;
  onCancel: () => void;
}

export default function EditProfile({
  initialName,
  initialPronouns,
  initialBio,
  onSave,
  onCancel,
}: EditProfileProps) {
  const [name, setName] = useState(initialName);
  const [pronouns, setPronouns] = useState(initialPronouns);
  const [bio, setBio] = useState(initialBio);

  async function handleSubmit() {
    await onSave(name || undefined, pronouns || undefined, bio || undefined);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-neutral-400 uppercase tracking-wide">
          Name
        </label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={limits.PROFILE_NAME}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-400 uppercase tracking-wide">
          Pronouns
        </label>
        <Input
          value={pronouns}
          onChange={(event) => setPronouns(event.target.value)}
          maxLength={limits.PROFILE_PRONOUNS}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-400 uppercase tracking-wide">
          Bio
        </label>
        <Textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={limits.PROFILE_BIO}
          rows={4}
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit}>save</Button>
        <button
          onClick={onCancel}
          className="text-neutral-400 hover:text-neutral-300 text-xs"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
