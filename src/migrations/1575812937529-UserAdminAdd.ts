import {MigrationInterface, QueryRunner} from "typeorm";

export class UserAdminAdd1575812937529 implements MigrationInterface {
    name = 'UserAdminAdd1575812937529'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `user` ADD `isAdmin` tinyint NOT NULL DEFAULT 0", undefined);
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL DEFAULT null", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL", undefined);
        await queryRunner.query("ALTER TABLE `user` DROP COLUMN `isAdmin`", undefined);
    }

}
