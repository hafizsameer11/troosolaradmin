import React, { useEffect, useMemo, useRef, useState } from "react";

export interface UserSearchOption {
  id: number;
  name: string;
  email: string;
  phone?: string;
  bvn?: string;
}

interface UserSearchSelectProps {
  value: string;
  onChange: (userId: string, user?: UserSearchOption) => void;
  users: UserSearchOption[];
  loading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

const buildSearchText = (user: UserSearchOption) =>
  [user.name, user.email, user.phone, user.bvn, String(user.id)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const UserSearchSelect: React.FC<UserSearchSelectProps> = ({
  value,
  onChange,
  users,
  loading = false,
  placeholder = "Search by name, email, phone, or user ID…",
  emptyMessage = "No users found",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(value)),
    [users, value]
  );

  useEffect(() => {
    if (!value) {
      setSearch("");
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) => buildSearchText(user).includes(term));
  }, [users, search]);

  const handleSelect = (user: UserSearchOption) => {
    onChange(String(user.id), user);
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedUser ? (
        <div className="flex items-center justify-between gap-3 w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {selectedUser.name}
            </p>
            <p className="text-gray-600 truncate">{selectedUser.email}</p>
            {selectedUser.phone ? (
              <p className="text-gray-500 text-xs truncate">{selectedUser.phone}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-sm text-[#273E8E] hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={loading ? "Loading users…" : placeholder}
            disabled={loading}
            className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50"
            autoComplete="off"
          />
          {open && !loading && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {filteredUsers.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-500 text-center">
                  {emptyMessage}
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    {(user.phone || user.bvn) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[user.phone, user.bvn ? `BVN: ${user.bvn}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
      {!selectedUser && users.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {users.length} user{users.length === 1 ? "" : "s"} available
          {search.trim() ? ` · ${filteredUsers.length} match` : ""}
        </p>
      )}
    </div>
  );
};

export default UserSearchSelect;
