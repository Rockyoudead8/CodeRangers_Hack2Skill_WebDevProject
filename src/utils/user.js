const users = [];

export function userJoin(userData) {
  // Check if user exists
  const index = users.findIndex(u => u.id === userData.id && u.roomId === userData.roomId);

  if (index !== -1) {
    // If user exists, replace them (updates the socketId)
    users[index] = userData;
    return users[index];
  }

  // If not, add them
  users.push(userData);
  return userData;
}

// ... keep userLeave and getUsers the same
export const userLeave = (socketId) => {
  const index = users.findIndex((user) => user.socketId === socketId);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
};

export const getUsers = (roomId) => {
  return users.filter((user) => user.roomId === roomId);
};