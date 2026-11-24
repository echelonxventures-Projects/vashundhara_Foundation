/**
 * CRM Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { CrmService } from '../services/crm.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
  ContactResponseDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationQueryDto,
  OrganizationResponseDto,
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateDealDto,
  UpdateDealDto,
  DealQueryDto,
  DealResponseDto,
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  CrmActivityQueryDto,
  CrmActivityResponseDto
} from '../dto';

@ApiTags('CRM')
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ============================================
  // Contact Endpoints
  // ============================================

  @Get('contacts')
  @ApiOperation({ summary: 'List all contacts with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of contacts' })
  async findAllContacts(@Query() query: ContactQueryDto) {
    return this.crmService.findAllContacts(query);
  }

  @Get('contacts/:id')
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findContactById(@Param('id') id: string) {
    return this.crmService.findContactById(id);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  @ApiResponse({ status: 409, description: 'Contact with this email already exists' })
  async createContact(@Body() dto: CreateContactDto) {
    return this.crmService.createContact(dto);
  }

  @Put('contacts/:id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 409, description: 'Contact with this email already exists' })
  async updateContact(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.crmService.updateContact(id, dto);
  }

  @Delete('contacts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a contact (soft delete)' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async deleteContact(@Param('id') id: string) {
    return this.crmService.deleteContact(id);
  }

  // ============================================
  // Organization Endpoints
  // ============================================

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of organizations' })
  async findAllOrganizations(@Query() query: OrganizationQueryDto) {
    return this.crmService.findAllOrganizations(query);
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOrganizationById(@Param('id') id: string) {
    return this.crmService.findOrganizationById(id);
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.crmService.createOrganization(dto);
  }

  @Put('organizations/:id')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.crmService.updateOrganization(id, dto);
  }

  @Delete('organizations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an organization (soft delete)' })
  @ApiResponse({ status: 200, description: 'Organization deleted successfully' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async deleteOrganization(@Param('id') id: string) {
    return this.crmService.deleteOrganization(id);
  }

  // ============================================
  // Pipeline Endpoints
  // ============================================

  @Get('pipelines')
  @ApiOperation({ summary: 'List all pipelines' })
  @ApiResponse({ status: 200, description: 'List of pipelines with stages' })
  async findAllPipelines() {
    return this.crmService.findAllPipelines();
  }

  @Get('pipelines/:id')
  @ApiOperation({ summary: 'Get a pipeline by ID with stages and deals' })
  @ApiResponse({ status: 200, description: 'Pipeline details' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async findPipelineById(@Param('id') id: string) {
    return this.crmService.findPipelineById(id);
  }

  @Post('pipelines')
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
  async createPipeline(@Body() dto: CreatePipelineDto) {
    return this.crmService.createPipeline(dto);
  }

  @Put('pipelines/:id')
  @ApiOperation({ summary: 'Update a pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline updated successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async updatePipeline(@Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.crmService.updatePipeline(id, dto);
  }

  @Delete('pipelines/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a pipeline (soft delete)' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete pipeline with existing deals' })
  async deletePipeline(@Param('id') id: string) {
    return this.crmService.deletePipeline(id);
  }

  // ============================================
  // Deal Endpoints
  // ============================================

  @Get('deals')
  @ApiOperation({ summary: 'List all deals with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of deals' })
  async findAllDeals(@Query() query: DealQueryDto) {
    return this.crmService.findAllDeals(query);
  }

  @Get('deals/:id')
  @ApiOperation({ summary: 'Get a deal by ID' })
  @ApiResponse({ status: 200, description: 'Deal details' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findDealById(@Param('id') id: string) {
    return this.crmService.findDealById(id);
  }

  @Post('deals')
  @ApiOperation({ summary: 'Create a new deal' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid pipeline, stage, contact, organization, or assignee' })
  async createDeal(@Body() dto: CreateDealDto) {
    return this.crmService.createDeal(dto);
  }

  @Put('deals/:id')
  @ApiOperation({ summary: 'Update a deal' })
  @ApiResponse({ status: 200, description: 'Deal updated successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @ApiResponse({ status: 400, description: 'Invalid pipeline, stage, contact, organization, or assignee' })
  async updateDeal(@Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.crmService.updateDeal(id, dto);
  }

  @Delete('deals/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a deal (soft delete)' })
  @ApiResponse({ status: 200, description: 'Deal deleted successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async deleteDeal(@Param('id') id: string) {
    return this.crmService.deleteDeal(id);
  }

  // ============================================
  // CRM Activity Endpoints
  // ============================================

  @Get('activities')
  @ApiOperation({ summary: 'List all CRM activities with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of activities' })
  async findAllActivities(@Query() query: CrmActivityQueryDto) {
    return this.crmService.findAllActivities(query);
  }

  @Post('activities')
  @ApiOperation({ summary: 'Create a new CRM activity' })
  @ApiResponse({ status: 201, description: 'Activity created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid contact, deal, or organization' })
  async createActivity(@Body() dto: CreateCrmActivityDto) {
    return this.crmService.createActivity(dto);
  }

  @Put('activities/:id')
  @ApiOperation({ summary: 'Update a CRM activity' })
  @ApiResponse({ status: 200, description: 'Activity updated successfully' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  async updateActivity(@Param('id') id: string, @Body() dto: UpdateCrmActivityDto) {
    return this.crmService.updateActivity(id, dto);
  }

  @Put('activities/:id/complete')
  @ApiOperation({ summary: 'Mark an activity as completed' })
  @ApiResponse({ status: 200, description: 'Activity completed successfully' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  async completeActivity(@Param('id') id: string, @Body() body: { outcome?: string }) {
    return this.crmService.completeActivity(id, body.outcome);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a CRM activity (soft delete)' })
  @ApiResponse({ status: 200, description: 'Activity deleted successfully' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  async deleteActivity(@Param('id') id: string) {
    return this.crmService.deleteActivity(id);
  }

  // ============================================
  // Dashboard / Stats Endpoints
  // ============================================

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get CRM dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getDashboardStats() {
    return this.crmService.getDashboardStats();
  }
}