import { User } from "../models/index.js";

export const userRepository = {
  findByEmail: (email, withPassword = false) => {
    const query = User.findOne({ email: email.toLowerCase() });
    return withPassword ? query.select("+passwordHash") : query;
  },
  findById: (id) => User.findById(id),
  listAll: () => User.find().select("name email department isActive").sort({ name: 1 }),
  create: (data) => User.create(data),
  updateById: (id, data) => User.findByIdAndUpdate(id, data, { returnDocument: "after" }),
  touchLastLogin: (id) => User.findByIdAndUpdate(id, { lastLoginAt: new Date() }),
};
