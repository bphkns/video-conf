import {MigrationInterface, QueryRunner} from "typeorm";

export class TeacherRefactor1574190550441 implements MigrationInterface {
    name = 'TeacherRefactor1574190550441'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `user` ADD `isActive` tinyint NULL DEFAULT 0", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `user` DROP COLUMN `isActive`", undefined);
    }

}
