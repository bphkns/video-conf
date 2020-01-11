import {MigrationInterface, QueryRunner} from "typeorm";

export class UserAdminAdd1575812789982 implements MigrationInterface {
    name = 'UserAdminAdd1575812789982'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL DEFAULT null", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL", undefined);
    }

}
