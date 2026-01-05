import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMonthlyTokensFromUserGroups1767624208683 implements MigrationInterface {
  name = 'RemoveMonthlyTokensFromUserGroups1767624208683';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the monthlyTokens column from user-groups table
    await queryRunner.query(`ALTER TABLE company_chat."user-groups" DROP COLUMN IF EXISTS "monthlyTokens"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the monthlyTokens column
    await queryRunner.query(`ALTER TABLE company_chat."user-groups" ADD COLUMN "monthlyTokens" integer`);
  }
}
