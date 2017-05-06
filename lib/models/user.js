module.exports = function UserModel (sequelize, DataTypes) {
  return sequelize.define('User', {
    team_id: { type: DataTypes.STRING, primaryKey: true },
    user_id: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },
    token: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    foodee_user_id: { type: DataTypes.STRING }
  });
};
