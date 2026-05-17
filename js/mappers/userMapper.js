export const UserMapper = {
  toView(user) {
    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      role: user.role,
      skills: user.skills || [],
      interests: user.interests || [],
      isActive: user.isActive ?? true,
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '',
    };
  },
};
