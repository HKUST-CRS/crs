import { UserModel } from "../schemas/user";
import type { IUser } from "../schemas/user";

export class UserService {
  /**
   * Create a new user
   */
  async createUser(userData: {
    id: string;
    name: string;
    email: string;
  }): Promise<IUser> {
    const user = new UserModel(userData);
    return await user.save();
  }

  /**
   * Find a user by ID
   */
  async findUserById(id: string): Promise<IUser | null> {
    return await UserModel.findOne({ id });
  }

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<IUser | null> {
    return await UserModel.findOne({ email });
  }

  /**
   * Update user information
   */
  async updateUser(
    id: string,
    updates: Partial<{ name: string; email: string }>
  ): Promise<IUser | null> {
    return await UserModel.findOneAndUpdate({ id }, updates, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(id: string): Promise<boolean> {
    const result = await UserModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  /**
   * Get all users sorted by name
   */
  async getAllUsers(): Promise<IUser[]> {
    return await UserModel.find({}).sort({ name: 1 });
  }
}
