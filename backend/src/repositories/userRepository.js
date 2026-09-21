import { User } from "../models/index.js";

export const userRepository = {
  findByEmail: (email, withPassword = false) => {
    const query = User.findOne({ email: email.toLowerCase() });
    return withPassword ? query.select("+passwordHash") : query;
  },
  findById: (id) => User.findById(id),
  create: (data) => User.create(data),
  updateById: (id, data) => User.findByIdAndUpdate(id, data, { returnDocument: "after" }),
  touchLastLogin: (id) => User.findByIdAndUpdate(id, { lastLoginAt: new Date() }),
};
